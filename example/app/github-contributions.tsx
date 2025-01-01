import { useDragSelect, type DragSelect } from "@osamaq/drag-select"
import { Fragment } from "react"
import { StyleSheet, Text, View, type TextInputProps } from "react-native"
import { GestureDetector } from "react-native-gesture-handler"
import Animated, {
  useAnimatedProps,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated"
import { AnimatedText } from "../components/animated-text"
import { Button } from "../components/button"

const itemSize = 30
const gap = 5

const paddingHorizontal = (itemSize + gap) * 0.5
const paddingVertical = 24

const daysInWeek = 7
const listHeight = daysInWeek * (itemSize + gap) - gap + paddingVertical * 2

const numItems = daysInWeek * 4 * 6 // 6 months
const data = Array.from({ length: numItems }).map((_, i) => ({
  id: `id_${i}`,
  date: new Date(2024, 0, i + 1).getTime(),
  contributionCount: Math.floor(Math.random() * 10),
}))

export default function GitHubContributions() {
  const ref = useAnimatedRef<Animated.ScrollView>()

  const { gestures, onScroll, selection } = useDragSelect({
    data,
    key: "id",
    list: {
      animatedRef: ref,
      itemSize: { width: itemSize, height: itemSize },
      columnGap: gap,
      rowGap: gap,
      numRows: daysInWeek,
      contentInset: {
        right: paddingHorizontal,
        left: paddingHorizontal,
        top: paddingVertical,
        bottom: paddingVertical,
      },
      horizontal: true,
    },
    longPressGesture: {
      minDurationMs: 150,
    },
    panGesture: {
      resetSelectionOnStart: true,
    },
    tapGesture: {
      selectOnTapEnabled: false,
    },
  })

  const scrollHandler = useAnimatedScrollHandler(onScroll)

  const panelVisibilityAnimatedStyle = useAnimatedStyle(() => {
    return {
      pointerEvents: selection.active.value ? "auto" : "none",
      opacity: withTiming(selection.active.value ? 1 : 0),
    }
  })

  const textFromAnimatedPropsFrom = useAnimatedProps(() => {
    let text = ""

    const indices = Object.values(selection.items.value).sort((a, b) => a - b)
    const high = indices.at(-1)
    if (high !== undefined) {
      const item = data[high]
      if (item) text = new Date(item.date).toDateString()
    }

    return {
      text,
    } as TextInputProps
  })

  const textToAnimatedPropsFrom = useAnimatedProps(() => {
    let text = ""

    const indices = Object.values(selection.items.value).sort((a, b) => a - b)
    const high = indices.at(0)
    if (high !== undefined) {
      const item = data[high]
      if (item) text = new Date(item.date).toDateString()
    }

    return {
      text,
    } as TextInputProps
  })

  return (
    <View style={styles.root}>
      <View style={styles.dateContainer}>
        <Text style={styles.text}>from</Text>
        <AnimatedText
          style={styles.date}
          animatedProps={textFromAnimatedPropsFrom}
        />
      </View>

      <View style={[styles.dateContainer, styles.marginTop]}>
        <Text style={styles.text}>to</Text>
        <AnimatedText
          style={styles.date}
          animatedProps={textToAnimatedPropsFrom}
        />
      </View>

      <View style={styles.graph}>
        <GestureDetector gesture={gestures.panHandler}>
          <Animated.ScrollView
            horizontal
            ref={ref}
            onScroll={scrollHandler}
            style={styles.list}
            contentContainerStyle={styles.listContainer}
            showsHorizontalScrollIndicator={false}
          >
            {data.map((item, i) => {
              const isTopLeftCorner = i === 0
              const isBottomLeftCorner = i === 6
              const isTopRightCorner = i === numItems - 7
              const isBottomRightCorner = i === numItems - 1

              const corner = (() => {
                if (isTopLeftCorner) return "top-left"
                if (isBottomLeftCorner) return "bottom-left"
                if (isTopRightCorner) return "top-right"
                if (isBottomRightCorner) return "bottom-right"
                return "none"
              })()

              const isNewWeek = i % 7 === 0
              const isFirstWeekInNewMonth =
                isNewWeek && new Date(item.date).getDate() <= 7
              const monthName = new Date(item.date).toLocaleDateString(
                "en-US",
                {
                  month: "short",
                }
              )

              return (
                <Fragment key={item.id}>
                  {isFirstWeekInNewMonth && (
                    <View
                      style={[
                        styles.monthContainer,
                        { left: (itemSize + gap) * (i / 7) },
                      ]}
                    >
                      <Text style={styles.month}>{monthName}</Text>
                    </View>
                  )}

                  <GestureDetector
                    gesture={gestures.createItemPressHandler(item.id, i)}
                  >
                    <ListItem
                      id={item.id}
                      selection={selection}
                      corner={corner}
                      contributionCount={item.contributionCount}
                    />
                  </GestureDetector>
                </Fragment>
              )
            })}
          </Animated.ScrollView>
        </GestureDetector>
      </View>

      <Button
        style={[styles.clearButton, panelVisibilityAnimatedStyle]}
        onPress={selection.clear}
      >
        <Text style={styles.clearButtonText}>Clear</Text>
      </Button>
    </View>
  )
}

function ListItem({
  id,
  selection,
  corner,
  contributionCount,
}: {
  id: string
  selection: DragSelect["selection"]
  corner: "top-left" | "top-right" | "bottom-left" | "bottom-right" | "none"
  contributionCount: number
}) {
  const lightness = contributionCount * 2 + 20
  const backgroundColor = `hsl(100, 50%, ${lightness}%)`
  const backgroundColor2 = `hsl(100, 10%, ${lightness}%)`

  const animatedStyle = useAnimatedStyle(() => {
    const isSelected = selection.ui.has(id)
    return {
      backgroundColor: isSelected ? backgroundColor2 : backgroundColor,
    }
  })

  const borderRadiusStyle = {
    borderTopLeftRadius: corner === "top-left" ? 16 : 6,
    borderBottomLeftRadius: corner === "bottom-left" ? 16 : 6,
    borderTopRightRadius: corner === "top-right" ? 16 : 6,
    borderBottomRightRadius: corner === "bottom-right" ? 16 : 6,
  }

  return (
    <Animated.View style={[styles.item, borderRadiusStyle, animatedStyle]} />
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 50,
  },
  graph: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  list: {
    flexGrow: 0,
  },
  listContainer: {
    height: listHeight,
    backgroundColor: "#1c1c1c",
    borderRadius: paddingHorizontal + 16,
    paddingHorizontal,
    paddingVertical,
    gap,
    flexWrap: "wrap",
    flexDirection: "column",
  },
  item: {
    height: itemSize,
    width: itemSize,
  },
  dateContainer: {
    width: "100%",
    rowGap: 30,
    paddingHorizontal: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  marginTop: { marginTop: 20 },
  date: {
    backgroundColor: "#1c1c1c",
    color: "white",
    fontSize: 22,
    fontWeight: "500",
    fontFamily: "Menlo",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 20,
    flex: 1,
    textAlign: "left",
  },
  text: {
    color: "white",
    fontSize: 20,
    flex: 0.5,
  },
  clearButton: {
    marginTop: 24,
    minWidth: 100,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: "#5c5c5c",
    alignItems: "center",
  },
  clearButtonText: {
    fontSize: 16,
    color: "#dddddd",
  },
  month: {
    color: "#bbbbbb",
    fontSize: 10,
    transform: [{ translateX: "50%" }],
    textAlign: "center",
  },
  monthContainer: {
    position: "absolute",
    top: 6,
    paddingLeft: paddingHorizontal,
  },
})
