# ECHOANA — interactive room-finder website

A static, no-server site: a rotating 3D care home + an emoji symptom quiz. The quiz
answers feed the project's **real trained model** (transpiled to JavaScript), which picks
the room group and **lights it up** in the 3D model. Hostable anywhere (GitHub Pages, a USB
stick, any laptop).

## Run it locally
```bash
python -m http.server 8753 --directory web
# open http://127.0.0.1:8753
```
(Needs internet the first time, to load Three.js from a CDN.)

## Add your real 3D model
Export the care home as **glTF Binary (`.glb`)** and drop it here:
```
web/models/carehome.glb
```
The site auto-detects it and replaces the placeholder. Until then, a procedural placeholder
of the 10 rooms is shown.

**Critical:** each room must be a **separate, named object** so it can be lit individually.
Name each room object exactly its room ID from `data/rooms.csv`:
```
A1 A2 A3 A4   B1 B2 B3   C1   D1 D2
```
The loader matches a mesh if its name equals (or contains) one of these IDs. Walls/floor/roof
can be any other objects. Keep units in metres, the model near the origin, and the file under
~15 MB.

*Fallback* if separate named rooms are hard: give the shell as one `.glb` plus a CSV of
`room_id, x, y, z` centres and we'll place glowing markers instead.

## How the ML runs in the browser
`src/export_web_model.py` transpiles the trained classifier (`dt_classifier.joblib` by
default — the same explainable tree on the board) to `web/js/model.js` via **m2cgen**. The
browser runs the real model; `web/js/assign.js` then applies the exact single/double
constraint (caretaker → {B,C}, solo → {A,D}) before picking the room. Re-run that script
whenever you retrain:
```bash
python src/export_web_model.py
```

## Files
| File | Role |
|------|------|
| `index.html` / `css/style.css` | layout + styling |
| `js/scene.js`  | Three.js scene, GLB loader / placeholder, room highlight |
| `js/quiz.js`   | emoji questions → the 12 clinical features |
| `js/model.js`  | the trained model, transpiled to JS (auto-generated) |
| `js/assign.js` | scores → constrained room recommendation |
| `js/main.js`   | quiz flow + result card |
| `models/`      | drop `carehome.glb` here |
