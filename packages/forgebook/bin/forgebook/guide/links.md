# Links for a person

Every story's `links` hold its page (`address`), its frame (`frame`), its component's page (`component`) and its
embed (`embed`). A component's
page can be drawn for who reads it: add an audience to the view, and send that link. `designer` shows usage guidance first
and no code, `coder` the API first with the code open, `tester` what the stories cover and their accessibility check:

```sh
npx forgebook story <id> --view audience=designer --json   # links.component opens the page for a designer
```

A frame runs its story's `play` unless its address says `play=off`; tests and `check` never say it. A person's catalogue may
start with plays off (a build does), so a link meant to show a story after its play says `play=on`.

`forgebook stories --tag beta --tag '!wip'` (or `tags` on `list_stories`) keeps the stories with any tag named and none
left out, as the sidebar's filter does in the address (`?tag=beta&tag=!wip`).

Each story also says whether a `play` function acts on it (`hasPlay`), and `tags` holds `!test` when the generated tests
leave it out.
