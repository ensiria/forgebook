/**
 * A module that reaches into React Native's own files, which have no web version.
 *
 * @module
 */
// biome-ignore lint/suspicious/noReactNativeDeepImports: the deep import the plugin must refuse
import "react-native/Libraries/Utilities/codegenNativeComponent";
