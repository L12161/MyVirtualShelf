# The Shelf

A personal shelf of books, films and YouTube videos, as a 3D animated site. Plain HTML, CSS and JavaScript: no build step, no server, free to host on GitHub Pages.

```
index.html               the shelf
admin.html, admin.*      the private "Add" form (see section 2)
styles.css               look and animation (sizes at the top)
app.js                   behavior: tabs, filters, 3D, cover colors
data.js                  ← YOUR CONTENT. The only file you edit day to day.
covers/                  ← your cover images
assets/background.jpg    ← replace with your own background image
```

---

## 1. Put it on GitHub Pages (one time, ~5 minutes)

1. Sign in at github.com and click **New repository** (the **+** at top right).
2. Name it, e.g. `shelf`. Leave it **Public** (Pages on private repos needs a paid plan). Click **Create repository**.
3. On the new repo page, click **uploading an existing file**. Drag in **everything inside** this folder: `index.html`, `styles.css`, `app.js`, `data.js`, and the `assets` and `covers` folders. Click **Commit changes**.
4. Go to **Settings → Pages** (left sidebar). Under **Build and deployment**, set **Source** to **Deploy from a branch**, choose **main** and **/ (root)**, then **Save**.
5. After a minute or two, the Pages screen shows your address: `https://<your-username>.github.io/shelf/`.

Want it at `https://<your-username>.github.io/` instead? Name the repository exactly `<your-username>.github.io`.

**Only you can add things.** Only people with write access to the repository can change it, and that is just you unless you add collaborators under **Settings → Collaborators**. Visitors can only look.

---

## 2. Add things with the form (recommended)

Your site has a private page at `https://<your-username>.github.io/shelf/admin.html`. Fill in the form, pick a cover, press **Add to shelf**, and it commits to your repository for you: the cover goes into `covers/` and the entry goes into `data.js`. The site updates a minute or two later.

The page is public, but it can't change anything without your **access token**, which only you have. It isn't linked from the shelf.

### One-time setup: make an access token

1. On GitHub, go to **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token** (or open https://github.com/settings/personal-access-tokens/new).
2. **Token name:** `shelf form`. **Expiration:** your choice. When it expires, make a new one and paste it in.
3. **Repository access:** **Only select repositories**, then pick your `shelf` repository.
4. **Permissions → Repository permissions → Contents:** **Read and write**. Leave everything else as it is.
5. Click **Generate token** and copy it. It starts with `github_pat_` and GitHub shows it only once.
6. Open `admin.html` on your site. Your username and repository are usually filled in already. Paste the token and click **Connect**.

Leave **Remember on this device** ticked on your own computer or phone. On a shared computer, untick it so the token is forgotten when you close the tab, or click **Forget token** when you're done.

### Good to know

- The token is stored only in that browser. It's never written to the repository.
- It can only touch this one repository's files. If you think it has leaked, delete it in the same GitHub settings page and make a new one.
- **YouTube video:** paste the link and the title and channel usually fill in by themselves.
- **Covers:** large images are shrunk to about 1000 px before upload, and the spine preview shows the colors that will be used.
- **Fixing or deleting an entry:** do that on GitHub by editing `data.js` (section 3). The form only adds.
- After the first save through the form, `data.js` is rewritten in a tidy, consistent layout and its inline comments are dropped. Your entries are kept exactly.

---

## 3. Add or edit a book or film by hand

1. **Upload the cover:** in your repo, open the `covers` folder → **Add file → Upload files** → drop the image → **Commit changes**. Name it simply, e.g. `the-hobbit.jpg`.
2. **Add the entry:** open `data.js` → click the **pencil** icon (Edit). Copy an existing entry and paste it at the **top** of its list:

   ```js
   books: [
     {
       title: "The Hobbit",
       author: "J.R.R. Tolkien",
       cover: "covers/the-hobbit.jpg",
       finished: "2026-11",
       rating: 5,
       take: "Cozier than I remembered."
     },
     {
       title: "Dune",
       ...
   ```

   Films use `director`, `year` and `watched` instead of `author` and `finished`.
3. Click **Commit changes**. The site updates in about a minute. Refresh with **Ctrl+Shift+R** (Mac: **Cmd+Shift+R**) if you still see the old version.

The spine colors are read from the cover automatically: the 3–4 main colors, in proportion.

## 4. Add a YouTube video by hand

No image needed. Paste the link:

```js
videos: [
  {
    title: "Video title",
    channel: "Channel name",
    url: "https://www.youtube.com/watch?v=XXXXXXXXXXX",
    watched: "2026-11",
    rating: 4,
    take: "Why I liked it."
  },
```

Short links (`youtu.be/...`) and Shorts links work too.

## 5. Change the background

Replace `assets/background.jpg` with your own image, keeping the same file name. In the repo: open `assets` → **Add file → Upload files** → upload a file named `background.jpg` → commit. It overwrites the placeholder.

If the image is too bright or too faint behind the shelf, change `backgroundDim` near the top of `data.js` (0 = full strength, 1 = dark).

---

## Field reference

| Field | Books | Films | Videos | Notes |
|---|---|---|---|---|
| `title` | ✔ | ✔ | ✔ | required |
| `author` / `director` / `channel` | author | director | channel | |
| `cover` | ✔ | ✔ | optional | path like `covers/name.jpg`; videos use the YouTube thumbnail if left out |
| `url` | | | ✔ | the YouTube link |
| `year` | | ✔ | | release year, shown on the VHS label |
| `finished` / `watched` | finished | watched | watched | `"2026-08"` (year-month) or just `"2026"` |
| `rating` | ✔ | ✔ | ✔ | 1–5, optional |
| `take` | ✔ | ✔ | ✔ | your review; a line break inside it becomes a new line |
| `link` | optional | optional | | adds an "Open link" button (e.g. Goodreads or Letterboxd) |

## If something breaks

- **The form says it can't write:** the token needs access to this repository with Contents set to "Read and write". If it says the token wasn't accepted, it has probably expired: make a new one.
- **Blank shelf with a message about data.js:** there's a typo in your last edit, almost always a missing comma between `}` and `{`, or a missing quote. Open the browser console (F12) to see the line number. On GitHub you can also open the commit history and undo the last change.
- **Cover doesn't show:** check that the `cover` path matches the file name exactly. Upper and lower case matter on GitHub Pages.
- **Spine colors look generic:** they come from the cover once it loads. When the site is opened straight from your computer by double-clicking it, the browser blocks reading the image, so colors only work once it's online, or with the local preview below.

## Preview on your computer (optional)

In this folder, run `python -m http.server 8000`, then open http://localhost:8000.
