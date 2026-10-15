// Turns a button's label into a stable element id: "Delete 3 rows" becomes "delete-rows". Hints in brackets and digits are
// dropped (digits stay when `keepDigits` is set, as menu items need: "2 spaces" and "4 spaces") so the id does not change with a
// count or a hint. Where a label itself changes ("of the selected object" or "of the
// whole document"), pass an explicit id instead.
export function toElementId(label: string, keepDigits = false) {
  return label
    .replace(/\([^)]*\)/g, '')
    .replace(keepDigits ? /(?!)/ : /[0-9]+/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}
