export type PropertyPaths<ListItem> =
  ListItem extends Record<string, any>
    ? {
        [Key in keyof ListItem]: Key extends string // Only allow `string` keys.
          ? ListItem[Key] extends string | number // Only allow keys which map to a `string` or `number` value.
            ? Key
            : `${Key}.${PropertyPaths<ListItem[Key]>}`
          : never
      }[keyof ListItem]
    : never

export function getPropertyByPath<T extends Record<string, unknown>>(
  object: T,
  path: string
): string {
  "worklet"
  let keys = path.split(".")
  let property: unknown
  do {
    const key = keys.shift()
    if (key) {
      property = object[key]
    }
  } while (keys.length !== 0)
  return property as string
}
