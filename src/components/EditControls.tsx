import { buildDownloadName, downloadTextFile } from '../formats/registry'
import type { EditingModule } from '../formats/registry'
import type { OpenedFile } from '../useFileIntake'

// A live region: screen readers hear "3 edited cells, 1 row deleted" whenever it changes.
export function ChangeCounter({ description }: { description: string }) {
  return (
    <p id="change-counter" role="status" aria-live="polite" className="shrink-0 text-sm font-medium">
      {description !== '' && (
        <span className="flex items-center gap-2">
          <span aria-hidden="true" className="size-2 rounded-full bg-edit-mark" />
          {description}
        </span>
      )}
    </p>
  )
}

// One click saves the file with every edit, named like sales-edited.xlsx.
export async function downloadEditedFile(openedFile: OpenedFile, editingModule: EditingModule, edits: unknown, exportSource: unknown, hasEdits: boolean) {
  const { downloadOption } = editingModule
  downloadTextFile(
    buildDownloadName(openedFile.file.name, hasEdits, downloadOption.extension),
    await downloadOption.createFile(edits, exportSource, { includeByteOrderMark: editingModule.getDefaultByteOrderMark(exportSource) }),
    downloadOption.getMimeType(exportSource),
  )
}
