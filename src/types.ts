import type {
  PanGesture,
  SimultaneousGesture,
} from "react-native-gesture-handler"
import type { AnimatedRef, DerivedValue } from "react-native-reanimated"
import type { ReanimatedScrollEvent } from "react-native-reanimated/lib/typescript/hook/commonTypes"
import type { PropertyPaths } from "./property-paths"

export interface Config<ListItem = unknown> {
  /**
   * The same array of items rendered on screen in a scrollable view.
   */
  data: Array<ListItem>
  /**
   * Key or path to nested key which uniquely identifies an item in the list.
   * Nested key path is specified using dot notation in a string e.g. `"user.id"`.
   *
   * @example
   * const item = { id: "usr_123", name: "foo" }
   * useDragSelect({ key: "id" })
   */
  key: PropertyPaths<ListItem>
  list: {
    /**
     * An [animated ref](https://docs.swmansion.com/react-native-reanimated/docs/core/useAnimatedRef) to
     * the scrollable view where the items are rendered.
     *
     * @example
     * const animatedRef = useAnimatedRef()
     * useDragSelect({ list: { animatedRef } })
     * return <Animated.FlatList ref={animatedRef} />
     */
    animatedRef: AnimatedRef<any>
    /**
     * Number of columns in the list.
     * @default 1
     */
    numColumns?: number
    /**
     * Amount of horizontal space between rows.
     * @default 0
     */
    rowGap?: number
    /**
     * Amount of vertical space between columns.
     * @default 0
     */
    columnGap?: number
    /**
     * Height and width of each item in the list.
     */
    itemSize: {
      width: number
      height: number
    }
    /**
     * Inner distance between edges of the list and its items.
     * Use this to account for list headers/footers and/or padding.
     */
    contentInset?: {
      top?: number
      bottom?: number
      left?: number
      right?: number
    }
  }
  /**
   * Configuration for the long press gesture. Long pressing an item activates selection mode.
   */
  longPressGesture?: {
    /**
     * Whether long pressing to activate selection mode is enabled.
     * @default true
     */
    enabled?: boolean
    /**
     * The amount of time in milliseconds an item must be pressed before selection mode activates.
     * @default 300
     */
    minDurationMs?: number
  }
  /**
   * Configuration for automatic scrolling.
   * This occurs when panning near scrolling edges of the list.
   */
  panScrollGesture?: {
    /**
     * Whether automatic scrolling is enabled.
     * @default true
     */
    enabled?: boolean
    /**
     * How close should the pointer be to the start of the list before **inverse** scrolling begins.
     * A value between 0 and 1 where 1 is equal to the height of the list window.
     * @default 0.15
     */
    startThreshold?: number
    /**
     * How close should the pointer be to the end of the list before scrolling begins.
     * A value between 0 and 1 where 1 is equal to the height of the list window.
     * @default 0.85
     */
    endThreshold?: number
    /**
     * The maximum scrolling speed when the pointer is near the starting edge of the list window.
     * Must be higher than 0.
     * @default
     *  - 8 on iOS
     *  - 1 on Android
     */
    startMaxVelocity?: number
    /**
     * The maximum scrolling speed when the pointer is at the ending edge of the list window.
     * Must be higher than 0.
     * @default
     *  - 8 on iOS
     *  - 1 on Android
     */
    endMaxVelocity?: number
  }
  /**
   * Invoked on the JS thread whenever an item is tapped, but not added to selection.
   * You may still wrap items with your own pressable component while using this callback to handle the press event.
   */
  onItemPress?: (id: string, index: number) => void
  /**
   * Invoked on the JS thread whenever an item is added to selection.
   */
  onItemSelected?: (id: string, index: number) => void
  /**
   * Invoked on the JS thread whenever an item is removed from selection.
   */
  onItemDeselected?: (id: string, index: number) => void
}

export interface DragSelect {
  /**
   * Must be used with [`useAnimatedScrollHandler`](https://docs.swmansion.com/react-native-reanimated/docs/scroll/useAnimatedScrollHandler)
   * and passed to the animated list to use automatic scrolling.
   * Used to obtain scroll offset and list window size.
   *
   * @example
   * const { onScroll } = useDragSelect()
   * const scrollHandler = useAnimatedScrollHandler(onScroll)
   * return <Animated.FlatList onScroll={scrollHandler} />
   */
  onScroll: (event: ReanimatedScrollEvent) => void
  gestures: {
    /**
     * This returns a composed [tap](https://docs.swmansion.com/react-native-gesture-handler/docs/gestures/tap-gesture) and
     * [long-press](https://docs.swmansion.com/react-native-gesture-handler/docs/gestures/long-press-gesture) gesture.
     * Note that the long press gesture can be disabled by setting `config.longPressGesture.enabled` to `false`. See {@link Config.longPressGesture}.
     *
     * Do not customize the behavior of this gesture directly.
     * Instead, [compose](https://docs.swmansion.com/react-native-gesture-handler/docs/gestures/composed-gestures) it with your own.
     */
    createItemPressHandler: (id: string, index: number) => SimultaneousGesture
    /**
     * This is a single [pan gesture](https://docs.swmansion.com/react-native-gesture-handler/docs/gestures/pan-gesture).
     * If you need to rely solely on pressing items for selection, you can disable the pan gesture by setting `config.panScrollGesture.enabled` to `false`. See {@link Config.panScrollGesture}.
     *
     * Do not customize the behavior of this gesture directly.
     * Instead, [compose](https://docs.swmansion.com/react-native-gesture-handler/docs/gestures/composed-gestures) it with your own.
     */
    panHandler: PanGesture
  }
  selection: {
    /**
     * Whether the selection mode is active.
     * Selection mode is active when there are any selected items.
     *
     * When active, tapping list items will add them or remove them from selection.
     * Config callbacks {@link Config.onItemSelected} and {@link Config.onItemDeselected} will be invoked instead of {@link Config.onItemPress}.
     */
    active: DerivedValue<boolean>
    /**
     * Add an item to selection.
     *
     * Must be invoked on the JS thread.
     */
    add: (id: string) => void
    /**
     * Clear all selected items.
     * Note that this does not trigger {@link Config.onItemDeselected}.
     *
     * Must be invoked on the JS thread.
     */
    clear: () => void
    /**
     * Remove an item from selection.
     *
     * Must be invoked on the JS thread.
     */
    delete: (id: string) => void
    /**
     * Indicates whether an item is selected.
     *
     * Must be invoked on the JS thread.
     */
    has: (id: string) => boolean
    /**
     * Count of currently selected items.
     */
    size: DerivedValue<number>
    /**
     * A mapping between selected item IDs and their indices.
     */
    items: DerivedValue<Record<string, number>>
    /**
     * Counterpart API for the UI thread.
     * Note that selection changes are reflected asynchronously on the JS thread and synchronously on the UI thread.
     */
    ui: {
      /**
       * Add an item to selection.
       *
       * Must be invoked on the UI thread.
       */
      add: (id: string) => void
      /**
       * Clear all selected items.
       * Note that this does not trigger {@link Config.onItemDeselected}.
       *
       * Must be invoked on the UI thread.
       */
      clear: () => void
      /**
       * Remove an item from selection.
       *
       * Must be invoked on the UI thread.
       */
      delete: (id: string) => void
      /**
       * Indicates whether an item is selected.
       *
       * Must be invoked on the UI thread.
       */
      has: (id: string) => boolean
    }
  }
}
