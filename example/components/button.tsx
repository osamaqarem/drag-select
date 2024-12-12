import type { PressableProps } from "react-native"
import { Pressable } from "react-native"
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type AnimatedProps,
} from "react-native-reanimated"

export const Button = (_props: AnimatedProps<PressableProps>) => {
  const props = _props as PressableProps

  const pressed = useSharedValue(false)

  const btnAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          scale: withTiming(pressed.value ? 0.95 : 1, {
            duration: 150,
          }),
        },
      ],
    }
  })

  const onPressIn: PressableProps["onPressIn"] = (e) => {
    pressed.value = true
    props.onPressIn?.(e)
  }

  const onPressOut: PressableProps["onPressOut"] = (e) => {
    pressed.value = false
    props.onPressOut?.(e)
  }

  return (
    <AnimatedPressable
      {...props}
      style={[btnAnimatedStyle, props.style]}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
    />
  )
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)
