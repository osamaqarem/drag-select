import type { FlatList } from "react-native"
import type { AnimatedRef } from "react-native-reanimated"

export interface Config<ListItem, Key> {
  /**
   * The same array of items given to the `FlatList`.
   */
  data: Array<ListItem>
  /**
   * The key to use to uniquely identify each item.
   */
  key: Key
  list: {
    /**
     * An animated ref to the `FlatList`.
     * This is necessary to automatically scroll the list when the pointer (finger) is near the edge of the view.
     *
     * @example
     * const flatlistRef = useAnimatedRef()
     * return <Animated.FlatList ref={flatlistRef} />
     */
    animatedRef: AnimatedRef<FlatList>
    /**
     * Number of columns in the list.
     */
    numColumns: number
    /**
     * Amount of horizontal space between rows.
     */
    rowSeparatorHeight: number
    /**
     * Amount of vertical space between columns.
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
  gestures: {
    /**
     * The amount of time an item must be long-pressed before drag-select mode activates.
     */
    longPressDurationMs: number
  }
  /**
   * Invoked on the JS thread whenever an item is pressed.
   */
  onItemPress: (item: ListItem) => void
  /**
   * Invoked on the JS thread whenever an item is added to selection.
   */
  onItemSelected: (item: ListItem) => void
  /**
   * Invoked on the JS thread whenever an item is removed from selection.
   */
  onItemDeselected: (item: ListItem) => void
}
