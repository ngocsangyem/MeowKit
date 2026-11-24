# Discovery Flow

The steps around the questions. Done when the user has agreed the premises and picked an approach.

## 1. Context

Read `CLAUDE.md` and `TODOS.md` if they exist, `git log --oneline -30`, and grep the areas the request touches. List earlier design docs with `ls -t tasks/plans/*/*-design-*.md` (titles and dates) and grep them for the problem's 3-5 keywords; if one overlaps, show it and ask whether to build on it or start fresh.

Then ask the real question that sets the mode: what is your goal? Startup or internal project means the startup diagnostic (stage: pre-product, has users, has paying customers); hackathon, open source, research, learning or fun means builder mode.

## 2. Landscape (optional)

Skip when search is unavailable. Ask before searching: this sends generalised category terms, never the idea's name or any proprietary concept. Search for common approaches and why incumbents fail or work (startup), or existing solutions and open-source alternatives (builder). Read the top two or three results and ask: what does everyone know, what does the discourse say, and given what this session found, is there a reason the conventional approach is wrong here? If there is a genuine insight, name it ("Everyone does X because they assume Y; the evidence here says otherwise"); if not, say the conventional wisdom looks sound.

## 3. Premises

Challenge before proposing: is this the right problem or is a simpler framing better; what happens if nothing is done; what existing code already partly solves it; for a new artifact (CLI, library, image, app) how users will get it. In startup mode, does the diagnostic evidence support this direction and where are the gaps?

Write the premises as statements and ask the user to agree or disagree with each; revise and repeat on disagreement.

## 4. Alternatives

When more than one path exists, give two or three approaches, each with a summary, effort (S-XL), risk, pros, cons and what it reuses, and a recommendation with its reason. Usually one is the minimal version and one the ideal architecture. When only one path exists, state it with the reasons the others were ruled out. For a wider technical option search use `mk:brainstorming`. The user approves an approach before the doc is written.

## 5. Outside perspectives (only on request)

A fresh-context second opinion on the problem, answers, premises and landscape, or a rough UI wireframe, is available when the user asks. A second opinion returns: the strongest version of what they are building, the one answer that reveals the most, one premise it thinks is wrong, and what it would build in 48 hours. Present it verbatim, then say where you agree and disagree; if it challenges a premise, ask whether to revise it. For a UI idea the wireframe is one self-contained rough HTML file (system fonts, no color, one to three states) written under the project's scratch area, not a polished mockup; if rendering needs a browser tool that is not installed, describe the layout in text and flag the gap.
