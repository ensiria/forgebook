# Judging coding agents' UI changes

Thank you for judging. Each pair shows two changes made by coding agents for the same request on the same open source
app. Your job is to say which of the two you would rather receive as a pull request, and why, on a fixed scale. You do
not need to run anything.

These instructions, the scale and the criteria were written before any agent ran. Please do not discuss pairs with
other judges until every sheet is in.

## What you have

- `pairs/<code>/index.html`: one page per pair. It shows the request, the constraints the change had to keep, each
  state of the screen as side A and side B left it (pictures you can click to open full size), then each side's change
  as a diff. Open it in any browser; it needs no network.
- `sheets/judge-<n>.csv`: your sheet. The organiser tells you your number. Open it in a spreadsheet, fill one row per
  pair, save it as CSV with the same columns, and send it back.

The two sides were made under different conditions. Which side is which was drawn at random for every pair, and the
codes say nothing. A few pairs come back a second time with their sides swapped, under another code: score each as if
it were new.

## How to score a pair

Look at the pictures first, then the diffs. Allow about four minutes per pair; do not agonise.

Every criterion uses the same scale:

| Score | Meaning |
|---|---|
| `-2` | A is clearly better |
| `-1` | A is somewhat better |
| `0` | No real difference, or both equally good or bad |
| `1` | B is somewhat better |
| `2` | B is clearly better |

The criteria, in the sheet's columns:

1. `asked`: does it do what was asked, completely? A side that does half the request, or something else, loses here.
2. `design`: does it fit the app as it already is? It uses the app's existing components and its colours, sizes and
   spacing, rather than new one-off ones or values typed by hand.
3. `states`: are the states handled: empty, long or odd content, a narrow window, the dark theme, errors where they
   apply? Look at every picture.
4. `accessible`: can everyone use it? Real buttons and labels, readable contrast, text a screen reader would announce,
   nothing that only works with a mouse. Judge from the pictures and the code.
5. `code`: is the change one you would accept in review? Focused on the request, nothing unrelated changed or deleted,
   readable, no tests removed or checks silenced.
6. `overall`: all things considered, which pull request would you rather receive? This is the main question. It is
   your own judgement, not an average of the five above.

Then:

- `merge_a`, `merge_b`: would you merge that side as it is, without asking for changes? `yes` or `no`, each on its own.
- `guess_tool`: one side had a tool to help it. If you have a guess which, write `A` or `B`; otherwise `unsure`. This
  only measures whether the conditions were hidden well. It does not affect your scores, and `unsure` is a fine answer.
- `minutes`: roughly how long the pair took you.
- `notes`: anything that decided it, in a few words. Optional, but it helps when judges disagree.

If a picture is missing, the page says why: that state could not be reached after the change. Count it against that
side, as a reviewer would.

## What not to do

- Do not try to find out which condition a side had, by searching the code or asking others.
- Do not run the apps or the code.
- Do not change the sheet's columns or its pair codes.
