import { DarkTheme, ThemeProvider } from "@react-navigation/native"
import { Drawer } from "expo-router/drawer"
import { StyleSheet } from "react-native"
import { GestureHandlerRootView } from "react-native-gesture-handler"

export default function Layout() {
  return (
    <GestureHandlerRootView style={styles.gestureHandlerRootView}>
      <ThemeProvider value={DarkTheme}>
        <Drawer>
          <Drawer.Screen
            name="index"
            options={{
              drawerLabel: "Home",
              title: "Home",
            }}
          />
          <Drawer.Screen
            name="gallery"
            options={{
              drawerLabel: "Photo Gallery",
              title: "Photo Gallery",
            }}
          />
          <Drawer.Screen
            name="file-manager"
            options={{
              drawerLabel: "File Manager",
              title: "File Manager",
            }}
          />
        </Drawer>
      </ThemeProvider>
    </GestureHandlerRootView>
  )
}

const styles = StyleSheet.create({
  gestureHandlerRootView: {
    flex: 1,
    backgroundColor: "black",
  },
})
