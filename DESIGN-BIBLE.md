# Turbo Vector Design Bible

`Turbo Vector` should stop behaving like a generic browser oval and become a proper top-down arcade racer in the spirit of *Super Cars*: cash pressure, rival identity, aggressive track obstacles, and "one more championship" momentum.

## Reference deep dive

### Super Cars

- strongest lesson: the racing is only half the game; the between-race shop and upgrade economy create the obsession
- borrow:
  - season/championship flow
  - prize money
  - repairs and upgrades
  - strong rival personality
  - occasional combat-racer spice

### Secondary references

- *Super Cars II* for higher tempo and multiplayer energy
- arcade racers generally for rubber-band tension and track readability

## Game design

### Fantasy

Rise from a lightly tuned amateur machine into a feared championship driver by winning dirty, dangerous top-down road races across a stylized near-future circuit.

### Pillars

- **Immediate handling**: you should understand the car inside one corner
- **Championship obsession**: money, repairs, upgrades, and standings must pull the player forward
- **Readable chaos**: traffic, oil, shortcuts, and rival pressure should be dramatic but legible
- **Short-session replayability**: races should be quick enough to encourage another run

### Structure

- career mode
- custom single race
- time trial
- local versus later

### Career loop

1. choose event
2. qualify or start on the grid
3. race while managing damage and rivals
4. collect prize money
5. repair, upgrade, or save for a better chassis
6. move to the next event

## Game mechanics

### Driving

- light drift on turn-in
- traction loss on grass, oil, sand, and rain
- drafting and turbo boost
- car damage affecting speed and handling

### Race features

- AI rivals with names and styles
- traffic or track hazards on selected events
- shortcuts with risk
- police/security presence in some street races

### Upgrade system

- engine
- gearbox
- tyres
- armor
- nitro
- brakes
- reliability

The shop needs to matter as much as the track.

## Sound design

- exaggerated engine note changes with clear upgrade impact
- tyre chirp and contact scrapes
- cash register / garage feedback that feels satisfying, not jokey
- crowd and track ambience should stay punchy and arcade-clean

## Music design

- bright synth-rock and driving electronic music
- menu music should feel aspirational and energetic
- race music should sell momentum rather than aggression alone
- post-race stings need strong emotional contrast for win/loss states

## Tutorials

Teach through a rookie cup opening:

1. accelerate and brake
2. cornering and drift
3. shortcut risk/reward
4. damage and repairs
5. first garage upgrade

## Menus

### Front end

- `Career`
- `Single Race`
- `Time Trial`
- `Garage`
- `Options`

### Key screens

- garage shop
- standings table
- rival dossiers
- championship calendar

The garage should be a hero screen, not a spreadsheet.

## Production roadmap

### Next prototype gains

- move from one test track to a small championship
- add named AI opponents
- add damage and money
- add a garage/shop loop

### Production engine

Godot 4 for the desktop build. It fits the 2D-heavy racing presentation and fast feature iteration we need.

## Visual references

- Super Cars on Steam: https://store.steampowered.com/app/2380300/Super_Cars_AmigaC64CPCSpectrum/
- Super Cars screenshot gallery: https://www.mobygames.com/game/12839/super-cars/screenshots/amiga/76913/
- Super Cars overview: https://en.wikipedia.org/wiki/Super_Cars
