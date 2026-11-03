/**
 * The touch of the stories marked for a phone (`parameters.touch`), and of those shown in a device frame unless their
 * device says otherwise (`parameters.device.touch`): each starts with a finger simulated, whatever the toolbar's Touch
 * switch says, until the user turns it off for that story (its example's toggle, or the Touch
 * switch on its own page).
 *
 * @remarks
 * The user's choice for a story lasts while the catalogue is open and is kept apart from the address: the address's
 * Touch switch stays the one the other stories follow, and a story's link opens it with its finger again.
 *
 * @module
 */
import { type DeviceDefault, type DeviceView, deviceDefaultOf, shownDevice } from "../deviceView.ts";
import type { TreeStory } from "../storyTree.ts";
import type { TouchChoice } from "../switches.ts";
import { isTouchView, type ViewState, withTouch, withTouchOf } from "../viewState.ts";

/** The user's choice for each story marked for a phone, by its id: whether it is touched with a finger. */
export type TouchOverrides = ReadonlyMap<string, boolean>;

/** Whether each story marked for a phone is touched with a finger, by its id; the other stories are left out. */
export type StoryTouches = ReadonlyMap<string, boolean>;

/** Whether a story is meant for a phone: marked so, or shown in a device that is touched. */
export type IsPhoneStory = (story: Pick<TreeStory, "isTouch" | "device">) => boolean;

/**
 * Whether a story is meant for a phone in a view: marked so, or shown in a device frame whose device is touched (a
 * phone behaves as one).
 *
 * @param view - the view's device.
 * @param catalogueDevice - the catalogue's default device, under each story's.
 */
export const phoneStories =
  (view: DeviceView, catalogueDevice: DeviceDefault): IsPhoneStory =>
  (story: Pick<TreeStory, "isTouch" | "device">): boolean =>
    story.isTouch || shownDevice(view, deviceDefaultOf(catalogueDevice, story.device))?.isTouch === true;

/**
 * Whether each of some stories meant for a phone is touched with a finger: as the user chose, a finger otherwise.
 *
 * @param stories - the stories.
 * @param overrides - the user's choices.
 * @param isPhone - whether a story is meant for a phone; marked so (`parameters.touch`) by default.
 */
export const storyTouchesOf = (
  stories: readonly TreeStory[],
  overrides: TouchOverrides,
  isPhone: IsPhoneStory = (story: Pick<TreeStory, "isTouch">): boolean => story.isTouch
): StoryTouches =>
  new Map(stories.filter(isPhone).map((story) => [story.id, overrides.get(story.id) ?? true]));

/**
 * The view a story is drawn with: the view, with a finger or the mouse for a story marked for a phone.
 *
 * @param view - the view.
 * @param storyId - the story's id.
 * @param touches - the stories marked for a phone.
 * @param choice - the catalogue's touch switch; none leaves every view as it is.
 */
export const touchedView = <View extends Pick<ViewState, "switches">>(
  view: View,
  storyId: string | undefined,
  touches: StoryTouches,
  choice: TouchChoice | undefined
): View => {
  const isTouch = storyId === undefined ? undefined : touches.get(storyId);
  return isTouch === undefined || choice === undefined ? view : withTouch(view, choice, isTouch);
};

/** A change of the view on a story's own page, split into the address's view and the story's own touch. */
export type StoryViewChange = {
  /** The address's view: the change, with the address's own Touch switch for a story marked for a phone. */
  readonly view: ViewState;
  /** The story's finger as the change sets it; none for a story not marked for a phone. */
  readonly isTouch?: boolean;
};

/**
 * A change of the view on a story's own page (the toolbar, the stage): for a story marked for a phone, the Touch
 * switch is the story's own and the address keeps its own.
 *
 * @param next - the changed view, from the one the story is drawn with.
 * @param addressView - the address's view.
 * @param story - the shown story.
 * @param choice - the catalogue's touch switch.
 * @param isPhone - whether the story is meant for a phone; marked so by default.
 */
export const storyViewChange = (
  next: ViewState,
  addressView: ViewState,
  story: TreeStory,
  choice: TouchChoice | undefined,
  isPhone: boolean = story.isTouch
): StoryViewChange =>
  !isPhone || choice === undefined
    ? { view: next }
    : { view: withTouchOf(next, addressView, choice), isTouch: isTouchView(next, choice) };
