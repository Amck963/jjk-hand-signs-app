#  JJK Gesture-Controlled Web App

A real-time browser based hand gesture recognition app inspired by *Jujutsu Kaisen*.
Uses your webcam to detect hand signs and trigger animated techniques such as **Red**, **Blue**, **Hollow Purple**, and **Domain Expansion**.

---

##  Features

* **Live webcam input**
*  **Real-time hand tracking** using MediaPipe
*  **Custom gesture detection logic**
*  **Technique Reversal: Red** (index finger)
*  **Cursed Technique Lapse: Blue** (peace sign)
*  **Hollow Purple** (bull horns)
*  **Domain Expansion: Infinite Void** (crossed fingers)
*  Particle effects, energy orbs, and screen flashes
*  Audio effects for each technique

---

##  Technologies Used

* **JavaScript (Vanilla)**
* **HTML5 / CSS3**
* **Canvas API** (for rendering effects)
* **MediaPipe Hands** (hand tracking & landmarks)
* **Web Audio API**

---

##  Project Structure

```
jjk-hand-sign-app/
├── index.html
├── style.css
├── app.js
└── assets/
    ├── red.mp3
    ├── blue.mp3
    ├── purple.mp3
    ├── domain.mp3
    
```

---

##  How It Works

The app uses **MediaPipe Hands** to detect 21 hand landmarks in real time.
These landmarks are processed to determine finger positions and identify gestures.

Example:

* **index finger** → Red
* **peace sign** → Blue
* **bull horn** → Hollow Purple
* **Crossed fingers (index + middle close)** → Domain Expansion

Custom logic is used to:

* avoid repeated triggering
* detect gesture transitions
* combine multiple hands into a single technique

---

##  How to Run

1. Clone the repository:

```bash
git clone https://github.com/Amck963/jjk-hand-sign-app.git
```

2. Open the project folder

3. Run a local server (recommended):

```bash
npx serve
```

or just open:

```bash
index.html
```

4. Allow camera access in your browser

---

##  Notes

* Works best in **Chrome**
* Requires webcam permission
* Gesture detection may vary depending on lighting and hand positioning

---

##  Future Improvements

* Gesture smoothing & stability detection
* Improved visual effects (Three.js / shaders)
* Machine learning-based gesture classification
* Mobile support
* More techniques & animations

---

---

##  What I Learned

* Real time computer vision in the browser
* Gesture recognition using landmark data
* Canvas based animation systems
* Handling asynchronous events and user input
* Structuring interactive front end applications

---

## 📬 Contact

If you're interested in this project or want to discuss opportunities, feel free to connect!

---

