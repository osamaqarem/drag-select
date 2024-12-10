import { Drawer } from "expo-router/drawer"
import { StatusBar } from "expo-status-bar"
import { StyleSheet } from "react-native"
import { GestureHandlerRootView } from "react-native-gesture-handler"
import { ThemeProvider, DarkTheme } from "@react-navigation/native"

export default function Layout() {
  return (
    <GestureHandlerRootView style={styles.gestureHandlerRootView}>
      <StatusBar style="light" />
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
              headerShown: false,
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
