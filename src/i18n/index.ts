import { Fragment, createContext, createElement, useContext } from 'react'
import type { ReactNode } from 'react'
import en from './en.json'
import ar from './ar.json'

// A small translation helper for the "what's new" feature: English and Arabic strings in en.json and ar.json. A page is Arabic
// when its address starts with /ar/ (the changelog); every other page is English. The Arabic file must have every key.

export type Locale = 'en' | 'ar'
export type MessageKey = keyof typeof en

const messages: Record<Locale, Record<MessageKey, string>> = { en, ar }

export function getLocaleFromPath(pathname: string): Locale {
  return pathname === '/ar' || pathname.startsWith('/ar/') ? 'ar' : 'en'
}

export const LocaleContext = createContext<Locale>('en')

// The text for a key with {name} placeholders filled in.
export function translate(locale: Locale, key: MessageKey, values: Record<string, string> = {}) {
  return messages[locale][key].replace(/\{(\w+)\}/g, (placeholder, name: string) => values[name] ?? placeholder)
}

export function useT() {
  const locale = useContext(LocaleContext)
  return { locale, t: (key: MessageKey, values?: Record<string, string>) => translate(locale, key, values) }
}

// The text for a key with each {name} replaced by an element, e.g. a sentence that holds links.
export function translateWithNodes(locale: Locale, key: MessageKey, nodes: Record<string, ReactNode>): ReactNode[] {
  return messages[locale][key].split(/(\{\w+\})/).map((piece, position) => {
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
