// Written to the themes folder the first time the app runs. After that the files belong to you.
export const DEFAULT_THEMES: Record<string, string> = {
  'default.yaml': `# Themes are plain YAML files. Edit this one, or copy it to make your own,
# then press "Reload" in the settings.
name: Default

# Colors. Leave one out to keep the default.
colors:
  ink: "#eef3f4"                       # main text
  dim: "#8ea3aa"                       # secondary text
  accent: "#c8e4ea"                    # highlights
  surface: "rgba(255, 255, 255, 0.05)" # player bar and buttons
  line: "rgba(255, 255, 255, 0.08)"    # thin borders
  deep: "#10181c"                      # text on light buttons

background:
  dim: "rgba(6, 10, 13, 0.8)"          # the dark layer over your screen
  # Extra layers are drawn on top of the dark layer, first one at the bottom.
  layers: []
  #  - type: gradient
  #    value: "linear-gradient(160deg, #1b2a31, #000000)"
  #    opacity: 0.5
  #  - type: image                      # a file on your computer, or a https:// link
  #    value: "C:/Users/you/Pictures/wallpaper.jpg"
  #    opacity: 0.4
  #    blur: 8                          # pixels
  #    size: cover                      # cover or contain
`,
  'ember.yaml': `name: Ember
colors:
  accent: "#ffb86b"
background:
  dim: "rgba(14, 8, 6, 0.84)"
  layers:
    - type: gradient
      value: "radial-gradient(circle at 80% 8%, #ff7a45, transparent 55%)"
      opacity: 0.4
    - type: gradient
      value: "radial-gradient(circle at 10% 100%, #b3261e, transparent 50%)"
      opacity: 0.3
`,
  'midnight.yaml': `name: Midnight
colors:
  accent: "#b69cff"
  dim: "#9a9bb8"
background:
  dim: "rgba(7, 6, 18, 0.86)"
  layers:
    - type: gradient
      value: "radial-gradient(ellipse at 50% 0%, #4b3bb5, transparent 60%)"
      opacity: 0.45
`,
  'mist.yaml': `name: Mist
colors:
  accent: "#c8e4ea"
background:
  dim: "rgba(8, 14, 18, 0.7)"
  layers:
    - type: gradient
      value: "radial-gradient(ellipse at 50% 20%, rgba(200, 228, 234, 0.5), transparent 60%)"
    - type: gradient
      value: "linear-gradient(#4d6a74, #26383f)"
      opacity: 0.35
`
};
