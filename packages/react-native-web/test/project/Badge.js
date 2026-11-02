/**
 * A badge written as Metro reads it: Flow types and JSX in a `.js` file, `__DEV__` read.
 *
 * @flow
 * @module
 */
import { Text } from "react-native";

type BadgeProps = { label: string };

/** A badge. */
export const Badge = ({ label }: BadgeProps) => <Text>{__DEV__ ? `dev ${label}` : label}</Text>;
