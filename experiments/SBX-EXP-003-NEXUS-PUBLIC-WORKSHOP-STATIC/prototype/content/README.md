# Publishing without an admin panel

The public website has no login, editor, database, upload form, or write API.
That absence is intentional.

To add something, ask the site editor to:

1. copy `_template.md`;
2. put it in the correct category folder;
3. name it `YYYY-MM-DD--short-lowercase-slug.md`;
4. preserve one H1 title and a short first paragraph;
5. run the complete build gate;
6. deploy only after the gate passes.

Category folders map directly to public labels:

- `notes` → Field note
- `positions` → Published position
- `demonstrations` → Working demonstration
- `evidence` → Evidence
- `experiments` → Open experiment

The accepted Markdown is deliberately small: paragraphs, H2/H3 headings,
lists, blockquotes, fenced code, inline code, and safe links. HTML, MDX,
scripts, embedded components, remote images, and executable expressions are
rejected.

Drafts belong in `_drafts`. Drafts are not compiled into the site, but the
repository is not a secret vault.
