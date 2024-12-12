import { StyleSheet, TextInput, type TextInputProps } from "react-native"
import Animated, { type AnimatedProps } from "react-native-reanimated"

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput)

export function AnimatedText({
  style,
  ...props
}: AnimatedProps<TextInputProps>) {
  return (
    <AnimatedTextInput
      {...props}
      style={[styles.input, style]}
      editable={false}
    />
  )
}

const styles = StyleSheet.create({
  input: {
    pointerEvents: "none",
  },
})
