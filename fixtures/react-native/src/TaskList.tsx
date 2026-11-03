/**
 * A day's tasks in a `FlatList`: each a row that ticks itself when pressed, with an empty state when there are none.
 *
 * @module
 */
import { type ReactNode, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";

/** One task. */
export type Task = {
  /** Its id, unique in the list. */
  readonly id: string;
  /** What to do. */
  readonly title: string;
  /** Whether it starts done. */
  readonly isDone?: boolean;
};

/** The list's props. */
export type TaskListProps = {
  /** The tasks, in order. */
  readonly tasks: readonly Task[];
  /** What the list says when there is no task; "Nothing to do" by default. */
  readonly emptyText?: string;
  /** Called with a task's id and whether it is now done, when its row is pressed. */
  readonly onToggle?: (id: string, isDone: boolean) => void;
};

/**
 * A day's tasks.
 *
 * @param props - the list's props.
 */
export const TaskList = ({ tasks, emptyText = "Nothing to do", onToggle }: TaskListProps): ReactNode => {
  const [done, setDone] = useState(() => new Set(tasks.filter((task) => task.isDone).map((task) => task.id)));
  const toggle = (id: string): void => {
    const next = new Set(done);
    const isDone = !next.has(id);
    if (isDone) next.add(id);
    else next.delete(id);
    setDone(next);
    onToggle?.(id, isDone);
  };
  return (
    <FlatList
      data={tasks}
      keyExtractor={(task) => task.id}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      ListEmptyComponent={<Text style={styles.empty}>{emptyText}</Text>}
      renderItem={({ item }) => (
        <Pressable
          role="checkbox"
          aria-checked={done.has(item.id)}
          onPress={(): void => toggle(item.id)}
          style={styles.row}
        >
          <View style={[styles.box, done.has(item.id) && styles.boxDone]} />
          <Text style={[styles.title, done.has(item.id) && styles.titleDone]}>{item.title}</Text>
        </Pressable>
      )}
    />
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 4 },
  box: { width: 20, height: 20, borderRadius: 6, borderWidth: 2, borderColor: "#2a6f97" },
  boxDone: { backgroundColor: "#2a6f97" },
  title: { fontSize: 16, color: "#10212c" },
  titleDone: { color: "#7d8f9b", textDecorationLine: "line-through" },
  separator: { height: 1, backgroundColor: "#e3eaef" },
  empty: { padding: 16, color: "#4a5d6b", textAlign: "center" }
});
