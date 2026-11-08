# What a catalogue may change

A catalogue may turn off its accessibility check (`a11y: false`) or its component docs (`componentDocs: false`). Then a
check's report says `"a11y": "off"` (it ran no axe: a pass says nothing of accessibility), and `story` says
`"componentDocs": "off"` with no `docs` and no required props: read the component's source for its props, and the
story's args for what it sets; `changed` finds no story through the imports, so check the stories you touched by name.

A story's frame runs on its own origin (the dev server's second port), unless the catalogue keeps it on its own
(`frames: "same-origin"`, `forgebook dev --frames same-origin`): open a story by the `page` or `frame` link an answer
gives, never by building a frame's address yourself, and do not expect a story's code to reach the catalogue's page or
its API.

An edit you save reaches the open story at once, a story file's in tens of milliseconds. One that the open story does
not show may not have reached the dev server: in a container, a Windows drive under WSL or a network drive, run it
with `forgebook dev --poll`. After `git switch` the dev server lists the branch's stories without a restart.

A client that renders MCP Apps also gets `story_preview`, which shows a story to the person, live, inside the conversation.
You do not see what it shows: to look at a story yourself, use `shot` (`story_shot`). Where the tool is not listed, the
client cannot show one: give the person the story's link, or its picture.

A catalogue draws with the app's own build: `tsconfig.json`'s `paths`, its `vite.config` (aliases, plugins except the
framework's and an app's own) and its PostCSS. When a story fails on an import or a class the app resolves, read what
`forgebook dev` printed about it; `appBuild` in the configuration turns each part off or names a plugin to skip or keep.
