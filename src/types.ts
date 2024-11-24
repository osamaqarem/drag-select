import type { AnimatedRef } from "react-native-reanimated"

export interface Config<ListItem> {
  /**
   * The same array of items rendered on screen in a scrollable view.
   */
  data: Array<ListItem>
  /**
   * Key or path to key which uniquely identifies an item in the list.
   *
   * @example
   * // Full code omitted for brevity.
   * const item = { id: "usr_123", name: "foo" }
   * useDragSelect({ key: "id" })
   */
  key: PropertyPaths<ListItem>
  list: {
    /**
     * An [animated ref](https://docs.swmansion.com/react-native-reanimated/docs/core/useAnimatedRef) to the scrollable view where the items are rendered.
     *
     * @example
     * // Full code omitted for brevity.
     * const animatedRef = useAnimatedRef()
     * useDragSelect({ list: { animatedRef } })
     * return <Animated.FlatList ref={animatedRef} />
     */
    animatedRef: AnimatedRef<any>
    /**
     * Number of columns in the list.
     */
    numColumns: number
    /**
     * Amount of horizontal space between items.
     */
    rowSeparatorHeight: number
    /**
     * Amount of vertical space between items.
     */
    columnSeparatorWidth: number
    /**
     * The height and width of each item in the list.
     */
    itemSize: {
      width: number
      height: number
    }
  }
  /**
   * Configuration for the long press gesture.
   * Used to enter 'select mode' by long pressing an item.
   */
  longPressGesture?: {
    /**
     * Whether long pressing to activate 'select mode' is enabled.
     * @default true
     */
    enabled?: boolean
    /**
     * The amount of time in milliseconds an item must be pressed before 'select mode' activates.
     * @default 300
     */
    minDurationMs?: number
  }
  /**
   * Configuration for automatic scrolling while panning gesture.
   */
  panScrollGesture?: {
    /**
     * Whether pan-scrolling is enabled.
     * @default true
     */
    enabled?: boolean
    /**
     * How close should the pointer be to the start of the list before **inverse** scrolling begins.
     * A value between 0 and 1 where 1 is equal to the height of the list.
     * @default 0.15
     */
    startThreshold?: number
    /**
     * How close should the pointer be to the end of the list before scrolling begins.
     * A value between 0 and 1 where 1 is equal to the height of the list.
     * @default 0.85
     */
    endThreshold?: number
    /**
     * The maximum scrolling speed when the pointer is near the starting edge of the list window.
     * Must be higher than 0.
     * @default 8
     */
    startMaxVelocity?: number
    /**
     * The maximum scrolling speed when the pointer is at the ending edge of the list window.
     * Must be higher than 0.
     * @default 8
     */
    endMaxVelocity?: number
  }
  /**
   * Invoked on the JS thread whenever an item is pressed.
   * @param {ListItem} item - The item that was pressed.
   */
  onItemPress: (item: ListItem) => void
  /**
   * Invoked on the JS thread whenever an item is added to selection.
   * @param {ListItem} item - The item that was selected.
   */
  onItemSelected: (item: ListItem) => void
  /**
   * Invoked on the JS thread whenever an item is removed from selection.
   * @param {ListItem} item - The item that was deselected.
   */
  onItemDeselected: (item: ListItem) => void
}

type PropertyPaths<ListItem> =
  ListItem extends Record<string, unknown>
    ? {
        [Key in keyof ListItem]: Key extends string // Only allow `string` keys.
          ? ListItem[Key] extends string | number // Only allow keys which map to a `string` or `number` value.
            ? Key
            : `${Key}.${PropertyPaths<ListItem[Key]>}`
          : never
      }[keyof ListItem]
    : never
