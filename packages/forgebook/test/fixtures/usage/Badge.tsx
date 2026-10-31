/**
 * A label, rendered by Row (so by Tree, through it) and by Card's stories.
 *
 * @module
 */
import type { ReactNode } from "react";

/**
 * A label.
 *
 * @param props - its text.
 */
export const Badge = ({ label }: { readonly label: string }): ReactNode => <span>{label}</span>;
