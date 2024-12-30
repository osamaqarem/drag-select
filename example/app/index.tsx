import { Link } from "expo-router"
import { Pressable, StyleSheet, Text, View } from "react-native"

export default function Recipes() {
  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>Drag Select</Text>
        <Text style={styles.subtitle}>Select a recipe</Text>
      </View>

      <View style={styles.container}>
        <Link style={styles.card} href="/gallery" asChild>
          <Pressable>
            <Text style={styles.cardText}>Photo Gallery</Text>
          </Pressable>
        </Link>

        <Link style={styles.card} href="/file-manager" asChild>
          <Pressable>
            <Text style={styles.cardText}>File Manager</Text>
          </Pressable>
        </Link>

        <Link style={styles.card} href="/github-contributions" asChild>
          <Pressable>
            <Text style={styles.cardText}>GitHub Contributions</Text>
          </Pressable>
        </Link>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "black",
    padding: 24,
  },
  header: {
    marginBottom: 30,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "white",
  },
  subtitle: {
    fontSize: 32,
    color: "#cfcfcf",
  },
  container: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: "10%",
    rowGap: 40,
  },
  card: {
    height: 60,
    width: "45%",
    paddingHorizontal: 4,
    backgroundColor: "#2c2c2c",
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  cardText: {
    textAlign: "center",
    color: "white",
  },
})
