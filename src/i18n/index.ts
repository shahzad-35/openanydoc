import { Fragment, createContext, createElement, useContext } from 'react'
import type { ReactNode } from 'react'
import en from './en.json'
import type ar from './ar.json'
import { toElementId } from '../elementId'

// A small translation helper: English and Arabic strings in en.json and ar.json, found by key. The language is the first part of
// the address (/en/... or /ar/...). The Arabic file must have every key of the English file (checked below); Arabic may add the
// plural forms English does not need (see translatePlural).

export type Locale = 'en' | 'ar'
export type MessageKey = keyof typeof en
type PluralSuffix = 'zero' | 'one' | 'two' | 'few' | 'many' | 'other'
// The name of a plural message: the keys "edit.cells.one" and "edit.cells.other" make the plural key "edit.cells".
export type PluralKey = MessageKey extends infer Key ? (Key extends `${infer Base}.${PluralSuffix}` ? Base : never) : never
type Values = Record<string, string | number>

export const LOCALES: Locale[] = ['en', 'ar']

// English is always there (element ids are made from it); Arabic is fetched by loadLocale before an Arabic page is drawn.
const messages: Partial<Record<Locale, Record<string, string>>> = { en }
// Fails to compile when ar.json lacks a key that en.json has.
const arabicHasEveryKey: Record<MessageKey, string> = {} as typeof ar
void arabicHasEveryKey

export async function loadLocale(locale: Locale) {
  if (locale === 'ar') messages.ar ??= (await import('./ar.json')).default
}

const getMessages = (locale: Locale): Record<string, string> => messages[locale] ?? en

// The address without its language: '/en/csv-viewer' is { locale: 'en', path: '/csv-viewer' }, '/ar' is { locale: 'ar', path: '/' }.
// An address with no language (an old link like '/csv-viewer') gives a null locale.
export function splitLocalePath(pathname: string): { locale: Locale | null; path: string } {
  const match = /^\/(en|ar)(\/.*)?$/.exec(pathname)
  if (!match) return { locale: null, path: pathname }
  const path = (match[2] ?? '/').replace(/\/+$/, '')
  return { locale: match[1] as Locale, path: path === '' ? '/' : path }
}

export function getLocaleFromPath(pathname: string): Locale {
  return splitLocalePath(pathname).locale ?? 'en'
}

// '/csv-viewer' in Arabic is '/ar/csv-viewer'; the home page is '/ar'.
export function localizePath(locale: Locale, path: string) {
  return path === '/' ? `/${locale}` : `/${locale}${path}`
}

// The language the browser asks for: the first of its languages that is Arabic or English, English when it asks for neither.
export function getBrowserLocale(): Locale {
  for (const language of navigator.languages ?? [navigator.language]) {
    const code = language.toLowerCase().slice(0, 2)
    if (code === 'ar' || code === 'en') return code
  }
  return 'en'
}

// Keep text of one direction from being scrambled inside a sentence of the other direction (an Arabic sentence that holds a file
// name or ".csv, .tsv"): wrap the value before passing it to t(). `isolateText` follows the text's own first letter (file names,
// cell values); `isolateLeftToRight` is for codes, extensions and cell addresses.
export const isolateText = (text: string) => `\u2068${text}\u2069`
export const isolateLeftToRight = (text: string) => `\u2066${text}\u2069`

export const LocaleContext = createContext<Locale>('en')
// Switches the page to the other language, keeping the same page (provided by App, which owns the address).
export const SwitchLanguageContext = createContext<(locale: Locale) => void>(() => {})
// The page's address without its language ('/csv-viewer'), provided by App so it is known in the build's server render too.
export const PagePathContext = createContext('/')

const formatNumber = (locale: Locale, count: number) => new Intl.NumberFormat(`${locale}-u-nu-latn`).format(count)

function fillValues(locale: Locale, text: string, values: Values) {
  return text.replace(/\{(\w+)\}/g, (placeholder, name: string) => {
    const value = values[name]
    if (value === undefined) return placeholder
    return typeof value === 'number' ? formatNumber(locale, value) : value
  })
}

// The text for a key with {name} placeholders filled in (numbers get thousands separators, Western digits in both languages).
export function translate(locale: Locale, key: MessageKey, values: Values = {}) {
  return fillValues(locale, getMessages(locale)[key], values)
}

// The text for a plural key and a count: "<key>.one", "<key>.other" ... chosen by the language's own plural rules (English has
// two forms, Arabic six: zero, one, two, few, many, other). A form the language file lacks falls back to "<key>.other". {count} is filled in.
export function translatePlural(locale: Locale, key: PluralKey, count: number, values: Values = {}) {
  const form = new Intl.PluralRules(locale).select(count)
  const text = getMessages(locale)[`${key}.${form}`] ?? getMessages(locale)[`${key}.other`]
  return fillValues(locale, text, { ...values, count })
}

export function useT() {
  const locale = useContext(LocaleContext)
  return {
    locale,
    t: (key: MessageKey, values?: Values) => translate(locale, key, values),
    tp: (key: PluralKey, count: number, values?: Values) => translatePlural(locale, key, count, values),
    // An element id made from the key's English text, so an id is the same in every language ("Delete rows" is always "delete-rows").
    idFor: (key: MessageKey, keepDigits = false) => toElementId(en[key], keepDigits),
  }
}

// The text for a key with each {name} replaced by an element, e.g. a sentence that holds links.
export function translateWithNodes(locale: Locale, key: MessageKey, nodes: Record<string, ReactNode>): ReactNode[] {
  return getMessages(locale)[key].split(/(\{\w+\})/).map((piece, position) => {
    const name = /^\{(\w+)\}$/.exec(piece)?.[1]
    return createElement(Fragment, { key: position }, name !== undefined && name in nodes ? nodes[name] : piece)
  })
}

// "A, B and C" in the page's language, with each item an element (so every one can be a link).
export function joinNodesAsList(locale: Locale, items: ReactNode[]): ReactNode[] {
  let nextItem = 0
  return new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' })
    .formatToParts(items.map((_, position) => String(position)))
    .map((part, position) => createElement(Fragment, { key: position }, part.type === 'element' ? items[nextItem++] : part.value))
}
