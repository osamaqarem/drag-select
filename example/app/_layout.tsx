import { Slot } from "expo-router"
import { StyleSheet } from "react-native"
import { GestureHandlerRootView } from "react-native-gesture-handler"

export default function Layout() {
  return (
    <GestureHandlerRootView style={styles.gestureHandlerRootView}>
      <Slot />
    </GestureHandlerRootView>
  )
}

const styles = StyleSheet.create({
  gestureHandlerRootView: {
    flex: 1,
  },
})
