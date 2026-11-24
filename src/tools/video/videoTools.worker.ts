// The video tools' worker: reads a video with Mediabunny (MPL-2.0, unmodified) and the browser's WebCodecs, changes it and writes
// the result in memory. GIFs are made with gifenc (MIT), frame ZIPs with fflate (MIT), MP3 with Mediabunny's LAME extension
// (LGPL, unmodified, loaded only when the browser has no MP3 encoder of its own, which is every browser today).
import { zipSync } from 'fflate'
import {
  ALL_FORMATS,
  AudioSample,
  AudioSampleSink,
  AudioSampleSource,
  BlobSource,
  BufferTarget,
  CanvasSink,
  CanvasSource,
  Conversion,
  Input,
  MkvOutputFormat,
  MovOutputFormat,
  Mp3OutputFormat,
  Mp4OutputFormat,
  OggOutputFormat,
  Output,
  QUALITY_HIGH,
  QUALITY_LOW,
  QUALITY_MEDIUM,
  QUALITY_VERY_HIGH,
  QUALITY_VERY_LOW,
  VideoSample,
  VideoSampleSink,
  VideoSampleSource,
  WavOutputFormat,
  WebMOutputFormat,
  canEncodeAudio,
  getFirstEncodableAudioCodec,
  getFirstEncodableVideoCodec,
} from 'mediabunny'
import type { AudioCodec, InputAudioTrack, OutputFormat, Quality, VideoCodec } from 'mediabunny'
import { CONTAINER_MIME_TYPES, VideoTaskFailed } from './videoTasks'
import type { ConvertSettings, FrameOverlay, OutputContainer, VideoInfo, VideoQuality, VideoTaskProgress, VideoTaskRequest, VideoTaskResponse } from './videoTasks'

const QUALITIES: Record<VideoQuality, Quality> = { 'very-low': QUALITY_VERY_LOW, low: QUALITY_LOW, medium: QUALITY_MEDIUM, high: QUALITY_HIGH, 'very-high': QUALITY_VERY_HIGH }
const AUDIO_CONTAINERS: OutputContainer[] = ['mp3', 'm4a', 'wav', 'ogg']

// Progress as thousandths, so the page's ProgressBar shows a smooth bar and a time left.
function reportProgress(fraction: number) {
  postMessage({ status: 'progress', done: Math.round(Math.min(1, Math.max(0, fraction)) * 1000), total: 1000 } satisfies VideoTaskProgress)
}

function outputFormatOf(container: OutputContainer): OutputFormat {
  if (container === 'mp4' || container === 'm4a') return new Mp4OutputFormat({ fastStart: 'in-memory' })
  if (container === 'mov') return new MovOutputFormat({ fastStart: 'in-memory' })
  if (container === 'webm') return new WebMOutputFormat()
  if (container === 'mkv') return new MkvOutputFormat()
  if (container === 'mp3') return new Mp3OutputFormat()
  if (container === 'wav') return new WavOutputFormat()
  return new OggOutputFormat()
}

async function prepareMp3Encoder(container: OutputContainer) {
  if (container !== 'mp3' || (await canEncodeAudio('mp3'))) return
  const { registerMp3Encoder } = await import('@mediabunny/mp3-encoder')
  registerMp3Encoder()
}

function openInput(file: Blob) {
  return new Input({ source: new BlobSource(file), formats: ALL_FORMATS })
}

// Encoders want even sizes.
const even = (size: number) => Math.max(2, Math.round(size / 2) * 2)

async function firstVideoCodecFor(format: OutputFormat, width: number, height: number) {
  return getFirstEncodableVideoCodec(format.getSupportedVideoCodecs(), { width: even(width), height: even(height) })
}

// The codecs people expect in each container, first choice first: a WebM to MP4 conversion is for players that want H.264 and AAC.
const PREFERRED_VIDEO_CODECS: Record<OutputContainer, VideoCodec[]> = { mp4: ['avc', 'hevc', 'vp9', 'av1'], mov: ['avc', 'hevc', 'prores'], mkv: ['avc', 'hevc', 'vp9', 'av1'], webm: ['vp9', 'vp8', 'av1'], mp3: [], m4a: [], wav: [], ogg: [] }
const PREFERRED_AUDIO_CODECS: Record<OutputContainer, AudioCodec[]> = { mp4: ['aac', 'opus'], mov: ['aac'], mkv: ['aac', 'opus'], webm: ['opus'], mp3: ['mp3'], m4a: ['aac'], wav: ['pcm-s16'], ogg: ['opus'] }

// The video codec to make: the visitor's choice when this browser can make it (otherwise an 'encode' error naming one it can), or
// the container's usual codec.
async function chooseVideoCodec(container: OutputContainer, format: OutputFormat, wanted: VideoCodec | undefined, width: number, height: number) {
  const size = { width: even(width), height: even(height) }
  const usual = (await getFirstEncodableVideoCodec(PREFERRED_VIDEO_CODECS[container], size)) ?? (await firstVideoCodecFor(format, width, height))
  if (!wanted) return usual ?? undefined
  if (!(await getFirstEncodableVideoCodec([wanted], size))) throw new VideoTaskFailed('encode', wanted, usual ?? undefined)
  return wanted
}

async function chooseAudioCodec(container: OutputContainer, format: OutputFormat) {
  const options = { numberOfChannels: 2, sampleRate: 48000 }
  return (await getFirstEncodableAudioCodec(PREFERRED_AUDIO_CODECS[container], options)) ?? (await getFirstEncodableAudioCodec(format.getSupportedAudioCodecs(), options))
}

async function probe(file: Blob): Promise<VideoInfo> {
  const input = openInput(file)
  if (!(await input.canRead())) throw new VideoTaskFailed('unreadable')
  const videoTrack = await input.getPrimaryVideoTrack()
  const audioTrack = await input.getPrimaryAudioTrack()
  const frameRateOf = async () => {
    const stats = await videoTrack!.computePacketStats(100)
    return stats.averagePacketRate || null
  }
  return {
    container: (await input.getFormat()).name,
    durationSeconds: await input.computeDuration(),
    sizeBytes: file.size,
    video: videoTrack && {
      codec: videoTrack.codec,
      codecString: await videoTrack.getCodecParameterString(),
      width: videoTrack.displayWidth,
      height: videoTrack.displayHeight,
      rotation: videoTrack.rotation,
      frameRate: await frameRateOf(),
      bitrate: await videoTrack.getAverageBitrate(),
      canDecode: await videoTrack.canDecode(),
    },
    audio: audioTrack && {
      codec: audioTrack.codec,
      codecString: await audioTrack.getCodecParameterString(),
      sampleRate: audioTrack.sampleRate,
      channels: audioTrack.numberOfChannels,
      bitrate: await audioTrack.getAverageBitrate(),
      canDecode: await audioTrack.canDecode(),
    },
    trackCount: (await input.getTracks()).length,
  }
}

// ---------------------------------------------------------------- drawing on frames (Add text, Blur area)

// A blur that looks the same in every browser's OffscreenCanvas (no `filter`): the box is shrunk and stretched back, twice.
function blurBox(context: OffscreenCanvasRenderingContext2D, left: number, top: number, width: number, height: number, strength: number) {
  if (width < 2 || height < 2) return
  const scale = Math.max(2, strength)
  const small = new OffscreenCanvas(Math.max(1, Math.round(width / scale)), Math.max(1, Math.round(height / scale)))
  const smallContext = small.getContext('2d')!
  smallContext.imageSmoothingQuality = 'high'
  smallContext.drawImage(context.canvas, left, top, width, height, 0, 0, small.width, small.height)
  smallContext.drawImage(small, 0, 0, small.width, small.height, 0, 0, Math.max(1, small.width / 2), Math.max(1, small.height / 2))
  smallContext.drawImage(small, 0, 0, Math.max(1, small.width / 2), Math.max(1, small.height / 2), 0, 0, small.width, small.height)
  context.imageSmoothingQuality = 'high'
  context.drawImage(small, left, top, width, height)
}

function overlayDrawer(overlay: FrameOverlay) {
  let canvas: OffscreenCanvas | null = null
  return (sample: VideoSample) => {
    const isShown = (overlay.fromSeconds === undefined || sample.timestamp >= overlay.fromSeconds) && (overlay.toSeconds === undefined || sample.timestamp < overlay.toSeconds)
    if (!isShown) return sample
    const width = sample.displayWidth
    const height = sample.displayHeight
    if (!canvas || canvas.width !== width || canvas.height !== height) canvas = new OffscreenCanvas(width, height)
    const context = canvas.getContext('2d')!
    sample.draw(context, 0, 0, width, height)
    for (const box of overlay.blurBoxes ?? []) blurBox(context, box.x * width, box.y * height, box.width * width, box.height * height, overlay.blurStrength ?? 12)
    if (overlay.picture) context.drawImage(overlay.picture, 0, 0, width, height)
    sample.close()
    return canvas
  }
}

// ---------------------------------------------------------------- convert (one file in, one file out)

async function convert(file: Blob, settings: ConvertSettings) {
  const input = openInput(file)
  if (!(await input.canRead())) throw new VideoTaskFailed('unreadable')
  const videoTrack = await input.getPrimaryVideoTrack()
  const audioTrack = await input.getPrimaryAudioTrack()
  const isAudioOnly = AUDIO_CONTAINERS.includes(settings.container)
  if (isAudioOnly && !audioTrack) throw new VideoTaskFailed('no-audio')
  if (!isAudioOnly && !videoTrack) throw new VideoTaskFailed('no-video')
  await prepareMp3Encoder(settings.container)

  const format = outputFormatOf(settings.container)
  const output = new Output({ format, target: new BufferTarget() })
  const shownWidth = videoTrack?.displayWidth ?? 0
  const shownHeight = videoTrack?.displayHeight ?? 0
  const videoCodec = isAudioOnly ? undefined : await chooseVideoCodec(settings.container, format, settings.videoCodec, settings.width ?? shownWidth, settings.height ?? shownHeight)
  const audioCodec = (await chooseAudioCodec(settings.container, format)) ?? undefined
  const changesPixels = Boolean(settings.quality || settings.videoBitrate || settings.overlay || settings.crop || settings.width || settings.rotate || settings.flip || settings.frameRate)
  const crop = settings.crop && {
    left: Math.round(settings.crop.x * shownWidth),
    top: Math.round(settings.crop.y * shownHeight),
    width: even(settings.crop.width * shownWidth),
    height: even(settings.crop.height * shownHeight),
  }
  // A vertical flip is a half turn and a mirror.
  const rotate = (((settings.rotate ?? 0) + (settings.flip === 'vertical' ? 180 : 0)) % 360) as 0 | 90 | 180 | 270

  const conversion = await Conversion.init({
    input,
    output,
    trim: settings.trim,
    composable: Boolean(settings.addedAudio),
    showWarnings: false,
    video: isAudioOnly
      ? { discard: true }
      : {
          codec: videoCodec,
          width: settings.width && even(settings.width),
          height: settings.height && even(settings.height),
          fit: settings.width && settings.height ? 'contain' : undefined,
          rotate: rotate || undefined,
          flip: settings.flip ? true : undefined,
          // Turned and mirrored pixels, not a note to the player: not every player reads that note.
          allowRotationMetadata: !(rotate || settings.flip),
          allowTransformationMetadata: !(rotate || settings.flip),
          crop,
          frameRate: settings.frameRate,
          bitrate: settings.videoBitrate ?? (settings.quality ? QUALITIES[settings.quality] : undefined),
          forceTranscode: changesPixels,
          process: settings.overlay ? overlayDrawer(settings.overlay) : undefined,
        },
    audio: settings.dropAudio || settings.addedAudio ? { discard: true } : { codec: audioCodec, bitrate: settings.audioBitrate, forceTranscode: isAudioOnly && settings.audioBitrate !== undefined },
  })
  if (!conversion.isValid) throw await failureOf(conversion, format)

  let feedAudio = async () => {}
  if (settings.addedAudio) {
    const durationSeconds = settings.trim ? settings.trim.end - settings.trim.start : await input.computeDuration()
    feedAudio = await addReplacementAudio(output, audioCodec, settings.addedAudio.file, settings.addedAudio.loop, durationSeconds)
    await output.start()
  }
  conversion.onProgress = (fraction) => reportProgress(fraction)
  await Promise.all([conversion.execute(), feedAudio()])
  if (settings.addedAudio) await output.finalize()
  return finishedFile(output, settings.container)
}

// Why Mediabunny could not set the conversion up, as the page's error: a codec this browser cannot read or make.
async function failureOf(conversion: Conversion, format: OutputFormat) {
  const discarded = conversion.discardedTracks.find((track) => track.reason === 'undecodable_source_codec' || track.reason === 'no_encodable_target_codec' || track.reason === 'unknown_source_codec')
  if (!discarded) return new VideoTaskFailed('failed')
  const codec = (await discarded.track.getCodec()) ?? undefined
  if (discarded.reason !== 'no_encodable_target_codec') return new VideoTaskFailed('decode', codec)
  const suggestion = discarded.track.isVideoTrack() ? await firstVideoCodecFor(format, 1280, 720) : await getFirstEncodableAudioCodec(format.getSupportedAudioCodecs())
  return new VideoTaskFailed('encode', codec, suggestion ?? undefined)
}

// Adds the sound track of `audioFile` to an output a composable conversion writes the picture of. Returns the function that feeds it.
async function addReplacementAudio(output: Output, audioCodec: AudioCodec | undefined, audioFile: Blob, loop: boolean, durationSeconds: number) {
  const audioInput = openInput(audioFile)
  const audioTrack = (await audioInput.canRead()) ? await audioInput.getPrimaryAudioTrack() : null
  if (!audioTrack) throw new VideoTaskFailed('no-audio')
  if (!(await audioTrack.canDecode())) throw new VideoTaskFailed('decode', audioTrack.codec ?? undefined)
  if (!audioCodec) throw new VideoTaskFailed('encode', audioTrack.codec ?? undefined)
  const source = new AudioSampleSource({ codec: audioCodec, bitrate: QUALITY_HIGH, transform: { numberOfChannels: 2, sampleRate: 48000 } })
  output.addAudioTrack(source)
  const audioDuration = await audioInput.computeDuration()
  return async () => {
    for (let offset = 0; offset < durationSeconds; offset += audioDuration) {
      for await (const sample of new AudioSampleSink(audioTrack).samples()) {
        const start = offset + sample.timestamp
        if (start >= durationSeconds) {
          sample.close()
          break
        }
        const kept = start + sample.duration > durationSeconds ? sample.trim(0, Math.floor((durationSeconds - start) * sample.sampleRate)) : sample
        kept.setTimestamp(start)
        await source.add(kept)
        kept.close()
        if (kept !== sample) sample.close()
      }
      if (!loop || audioDuration < 0.05) break
    }
    source.close()
  }
}

async function finishedFile(output: Output, container: OutputContainer) {
  const bytes = new Uint8Array((output.target as BufferTarget).buffer!)
  return { bytes, mimeType: CONTAINER_MIME_TYPES[container], extension: container }
}

// ---------------------------------------------------------------- join (Merge, Loop, Change speed)

const JOIN_SAMPLE_RATE = 48000
const JOIN_CHANNELS = 2

// Turns sound at any rate (and any speed: played `speed` times faster, so its pitch rises with it) into 48 kHz stereo. Linear
// interpolation, carried across samples so there is no click between them.
class SoundResampler {
  private position = 0
  private previous: Float32Array[] = []
  private readonly step: number
  constructor(step: number) {
    this.step = step
  }
  resample(channels: Float32Array[]) {
    const joined = channels.map((channel, index) => {
      const before = this.previous[index] ?? new Float32Array(0)
      const all = new Float32Array(before.length + channel.length)
      all.set(before)
      all.set(channel, before.length)
      return all
    })
    const frameCount = joined[0].length
    const made: number[][] = joined.map(() => [])
    while (this.position + 1 < frameCount) {
      const whole = Math.floor(this.position)
      const part = this.position - whole
      joined.forEach((channel, index) => made[index].push(channel[whole] * (1 - part) + channel[whole + 1] * part))
      this.position += this.step
    }
    const keepFrom = Math.min(Math.floor(this.position), frameCount)
    this.previous = joined.map((channel) => channel.slice(keepFrom))
    this.position -= keepFrom
    return made.map((channel) => Float32Array.from(channel))
  }
}

function channelsOf(sample: AudioSample) {
  const channels: Float32Array[] = []
  for (let channel = 0; channel < sample.numberOfChannels; channel++) {
    const data = new Float32Array(sample.numberOfFrames)
    sample.copyTo(data, { planeIndex: channel, format: 'f32-planar' })
    channels.push(data)
  }
  // Mono plays on both sides; more than two channels keep the front pair.
  return channels.length === 1 ? [channels[0], channels[0]] : channels.slice(0, 2)
}

function stereoSample(channels: Float32Array[], timestamp: number) {
  const data = new Float32Array(channels[0].length * 2)
  data.set(channels[0])
  data.set(channels[1], channels[0].length)
  return new AudioSample({ data, format: 'f32-planar', numberOfChannels: JOIN_CHANNELS, sampleRate: JOIN_SAMPLE_RATE, timestamp })
}

async function join(request: Extract<VideoTaskRequest, { type: 'join' }>) {
  const { container, frameRate, speed } = request
  const width = even(request.width)
  const height = even(request.height)
  const inputs = request.parts.map((part) => ({ ...part, input: openInput(part.file) }))
  const tracks = await Promise.all(
    inputs.map(async ({ input }) => {
      if (!(await input.canRead())) throw new VideoTaskFailed('unreadable')
      const video = await input.getPrimaryVideoTrack()
      if (!video) throw new VideoTaskFailed('no-video')
      if (!(await video.canDecode())) throw new VideoTaskFailed('decode', video.codec ?? undefined)
      const audio = request.dropAudio ? null : await input.getPrimaryAudioTrack()
      return { video, audio: audio && (await audio.canDecode()) ? audio : null, duration: await input.computeDuration() }
    }),
  )
  const format = outputFormatOf(container)
  const videoCodec = await chooseVideoCodec(container, format, undefined, width, height)
  if (!videoCodec) throw new VideoTaskFailed('encode')
  const output = new Output({ format, target: new BufferTarget() })
  const videoSource = new VideoSampleSource({ codec: videoCodec, bitrate: QUALITIES[request.quality] })
  output.addVideoTrack(videoSource, { frameRate })
  const hasSound = tracks.some((track) => track.audio)
  const audioCodec = hasSound ? await chooseAudioCodec(container, format) : null
  const audioSource = audioCodec ? new AudioSampleSource({ codec: audioCodec, bitrate: QUALITY_HIGH }) : null
  if (audioSource) output.addAudioTrack(audioSource)
  await output.start()

  const canvas = new OffscreenCanvas(width, height)
  const context = canvas.getContext('2d')!
  const partLengths = inputs.map((part, index) => ((part.end ?? tracks[index].duration) - (part.start ?? 0)) / speed)
  const totalLength = partLengths.reduce((sum, length) => sum + length, 0)
  let offset = 0
  for (const [index, part] of inputs.entries()) {
    const start = part.start ?? 0
    const end = part.end ?? tracks[index].duration
    const partLength = partLengths[index]
    // Frames: drawn to the output size (letterboxed), at most `frameRate` per second, so 4× speed doesn't make 4× the frames.
    let nextFrameTime = offset
    for await (const sample of new VideoSampleSink(tracks[index].video).samples(start, end)) {
      const time = offset + (sample.timestamp - start) / speed
      if (time + 1e-6 >= nextFrameTime && time < offset + partLength) {
        context.fillStyle = '#000'
        context.fillRect(0, 0, width, height)
        sample.drawWithFit(context, { fit: 'contain' })
        const frame = new VideoSample(canvas, { timestamp: time, duration: 1 / frameRate })
        await videoSource.add(frame)
        frame.close()
        nextFrameTime = time + 1 / frameRate
      }
      sample.close()
      reportProgress((offset + (time - offset)) / totalLength)
    }
    if (audioSource) await addJoinedSound(audioSource, tracks[index].audio, start, end, offset, partLength, speed)
    offset += partLength
  }
  videoSource.close()
  audioSource?.close()
  await output.finalize()
  return finishedFile(output, container)
}

async function addJoinedSound(source: AudioSampleSource, track: InputAudioTrack | null, start: number, end: number, offset: number, partLength: number, speed: number) {
  let written = 0
  if (track) {
    const resampler = new SoundResampler((track.sampleRate * speed) / JOIN_SAMPLE_RATE)
    for await (const sample of new AudioSampleSink(track).samples(start, end)) {
      const channels = resampler.resample(channelsOf(sample))
      sample.close()
      const room = Math.floor((partLength - written / JOIN_SAMPLE_RATE) * JOIN_SAMPLE_RATE)
      const kept = channels.map((channel) => channel.subarray(0, Math.max(0, room)))
      if (kept[0].length === 0) continue
      const made = stereoSample(kept, offset + written / JOIN_SAMPLE_RATE)
      await source.add(made)
      made.close()
      written += kept[0].length
    }
  }
  // A part without sound (or with less than its picture) gets silence, so the next part's sound starts with its picture.
  const missing = Math.floor(partLength * JOIN_SAMPLE_RATE) - written
  for (let done = 0; done < missing; done += JOIN_SAMPLE_RATE) {
    const length = Math.min(JOIN_SAMPLE_RATE, missing - done)
    const silence = stereoSample([new Float32Array(length), new Float32Array(length)], offset + (written + done) / JOIN_SAMPLE_RATE)
    await source.add(silence)
    silence.close()
  }
}

// ---------------------------------------------------------------- frames, GIF, pictures to video

async function primaryVideoTrackOf(file: Blob) {
  const input = openInput(file)
  if (!(await input.canRead())) throw new VideoTaskFailed('unreadable')
  const track = await input.getPrimaryVideoTrack()
  if (!track) throw new VideoTaskFailed('no-video')
  if (!(await track.canDecode())) throw new VideoTaskFailed('decode', track.codec ?? undefined)
  return track
}

async function extractFrames(request: Extract<VideoTaskRequest, { type: 'frames' }>) {
  const track = await primaryVideoTrackOf(request.file)
  const scale = request.maxWidth && track.displayWidth > request.maxWidth ? request.maxWidth / track.displayWidth : 1
  const sink = new CanvasSink(track, { width: even(track.displayWidth * scale), height: even(track.displayHeight * scale), fit: 'fill', poolSize: 1 })
  const mimeType = request.format === 'png' ? 'image/png' : 'image/jpeg'
  const pictures: { name: string; bytes: Uint8Array }[] = []
  let index = 0
  for await (const wrapped of sink.canvasesAtTimestamps(request.times)) {
    index++
    reportProgress(index / request.times.length)
    if (!wrapped) continue
    const blob = await (wrapped.canvas as OffscreenCanvas).convertToBlob({ type: mimeType, quality: 0.92 })
    const time = request.times[index - 1].toFixed(2).replace('.', '_')
    pictures.push({ name: `${request.baseName}-${String(index).padStart(4, '0')}-${time}s.${request.format}`, bytes: new Uint8Array(await blob.arrayBuffer()) })
  }
  if (pictures.length === 0) throw new VideoTaskFailed('failed')
  if (pictures.length === 1) return { bytes: pictures[0].bytes, mimeType, extension: request.format }
  return { bytes: zipSync(Object.fromEntries(pictures.map((picture) => [picture.name, [picture.bytes, { level: 0 }]]))), mimeType: 'application/zip', extension: 'zip' }
}

async function makeGif(request: Extract<VideoTaskRequest, { type: 'gif' }>) {
  const { GIFEncoder, quantize, applyPalette } = await import('gifenc')
  const track = await primaryVideoTrackOf(request.file)
  const width = even(Math.min(request.width, track.displayWidth))
  const height = even((track.displayHeight * width) / track.displayWidth)
  const sink = new CanvasSink(track, { width, height, fit: 'fill', poolSize: 1 })
  const times: number[] = []
  // Counted, not added up: adding 1/frameRate drifts (0 to 5 s at 10 per second made 51 frames).
  const frameCount = Math.ceil((request.end - request.start) * request.frameRate - 1e-6)
  for (let index = 0; index < frameCount; index++) times.push(request.start + index / request.frameRate)
  const gif = GIFEncoder()
  const delay = Math.round(1000 / request.frameRate)
  let index = 0
  for await (const wrapped of sink.canvasesAtTimestamps(times)) {
    index++
    reportProgress(index / times.length)
    if (!wrapped) continue
    const pixels = (wrapped.canvas as OffscreenCanvas).getContext('2d')!.getImageData(0, 0, width, height).data
    const palette = quantize(pixels, 256)
    gif.writeFrame(applyPalette(pixels, palette), width, height, { palette, delay })
  }
  gif.finish()
  return { bytes: gif.bytes(), mimeType: 'image/gif', extension: 'gif' }
}

async function picturesToVideo(request: Extract<VideoTaskRequest, { type: 'pictures-to-video' }>) {
  const first = request.pictures[0]
  if (!first) throw new VideoTaskFailed('failed')
  const width = even(first.width)
  const height = even(first.height)
  const format = outputFormatOf(request.container)
  const videoCodec = await chooseVideoCodec(request.container, format, undefined, width, height)
  if (!videoCodec) throw new VideoTaskFailed('encode')
  const output = new Output({ format, target: new BufferTarget() })
  const canvas = new OffscreenCanvas(width, height)
  const context = canvas.getContext('2d')!
  const source = new CanvasSource(canvas, { codec: videoCodec, bitrate: QUALITY_HIGH, keyFrameInterval: request.secondsEach })
  output.addVideoTrack(source, { frameRate: request.frameRate })
  await output.start()
  const framesEach = Math.max(1, Math.round(request.secondsEach * request.frameRate))
  const frameCount = framesEach * request.pictures.length
  for (let frame = 0; frame < frameCount; frame++) {
    if (frame % framesEach === 0) {
      context.fillStyle = '#fff'
      context.fillRect(0, 0, width, height)
      context.drawImage(request.pictures[frame / framesEach], 0, 0, width, height)
    }
    await source.add(frame / request.frameRate, 1 / request.frameRate)
    reportProgress((frame + 1) / frameCount)
  }
  request.pictures.forEach((picture) => picture.close())
  source.close()
  await output.finalize()
  return finishedFile(output, request.container)
}

// ---------------------------------------------------------------- the message

async function answer(request: VideoTaskRequest): Promise<VideoTaskResponse> {
  if (request.type === 'probe') return { status: 'ok', info: await probe(request.file) }
  if (request.type === 'encodable') {
    const format = outputFormatOf(request.container)
    await prepareMp3Encoder(request.container)
    const size = { width: even(request.width ?? 1280), height: even(request.height ?? 720) }
    const videoCodecs: VideoCodec[] = []
    for (const codec of format.getSupportedVideoCodecs()) if (await getFirstEncodableVideoCodec([codec], size)) videoCodecs.push(codec)
    const audioCodecs: AudioCodec[] = []
    for (const codec of format.getSupportedAudioCodecs()) if (await canEncodeAudio(codec)) audioCodecs.push(codec)
    return { status: 'ok', videoCodecs, audioCodecs }
  }
  if (request.type === 'convert') return { status: 'ok', ...(await convert(request.file, request.settings)) }
  if (request.type === 'join') return { status: 'ok', ...(await join(request)) }
  if (request.type === 'frames') return { status: 'ok', ...(await extractFrames(request)) }
  if (request.type === 'gif') return { status: 'ok', ...(await makeGif(request)) }
  return { status: 'ok', ...(await picturesToVideo(request)) }
}

self.onmessage = async (event: MessageEvent<VideoTaskRequest>) => {
  try {
    const response = await answer(event.data)
    postMessage(response, { transfer: response.status === 'ok' && response.bytes ? [response.bytes.buffer as ArrayBuffer] : [] })
  } catch (error) {
    if (error instanceof VideoTaskFailed) postMessage({ status: 'error', reason: error.reason, codec: error.codec, suggestion: error.suggestion } satisfies VideoTaskResponse)
    else {
      console.error(error)
      postMessage({ status: 'error', reason: 'failed' } satisfies VideoTaskResponse)
    }
  }
}
