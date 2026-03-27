import { Howl, Howler } from 'howler'

class SoundsManager {
  constructor() {
    this.mutedSounds = new Set()
    this.allMuted = false
    this.musicEnabled = false
    this.masterVolume = 1.0
    this.sfxVolume = 0.9
    this.musicVolume = 0.35
    this._musicDuckTimer = null
    this.sounds = {
      pop: new Howl({ src: ['assets/sfx/pop.mp3'] }),
      roll: new Howl({ src: ['assets/sfx/roll.mp3'] }),
      good: new Howl({ src: ['assets/sfx/good.mp3'] }),
      intro: new Howl({ src: ['assets/sfx/intro.mp3'] }),
      incorrect: new Howl({ src: ['assets/sfx/incorrect.mp3'] }),
    }

    this._loadPreferences()
  }

  _loadPreferences() {
    try {
      const prefs = JSON.parse(localStorage.getItem('sound_prefs') || '{}')
      this.allMuted = prefs.muted || false
      this.musicEnabled = prefs.musicEnabled || false
      this.masterVolume = prefs.volume ?? 1.0
      this.sfxVolume = prefs.sfxVolume ?? 0.9
      this.musicVolume = prefs.musicVolume ?? 0.35
      Howler.volume(this.masterVolume)
      if (this.allMuted) {
        Howler.mute(true)
      }
    } catch (e) {}
  }

  _savePreferences() {
    try {
      localStorage.setItem('sound_prefs', JSON.stringify({
        muted: this.allMuted,
        musicEnabled: this.musicEnabled,
        volume: this.masterVolume,
        sfxVolume: this.sfxVolume,
        musicVolume: this.musicVolume,
      }))
    } catch (e) {}
  }

  play(name, baseRate = 1.0, variation = 0.2, volume = 1.0) {
    if (this.allMuted || this.mutedSounds.has(name)) return

    const sound = this.sounds[name]
    if (!sound) return
    const id = sound.play()
    sound.rate(baseRate - variation / 2 + Math.random() * variation, id)
    sound.volume(volume * this.sfxVolume * this.masterVolume, id)
    return id
  }

  playMusic(name = 'intro', volume = 0.3) {
    if (!this.musicEnabled) return
    if (this.allMuted) return
    const sound = this.sounds[name]
    if (!sound) return
    if (sound.playing()) return
    sound.loop(true)
    sound.volume(0)
    sound.play()
    sound.fade(0, volume * this.musicVolume * this.masterVolume, 2000)
  }

  toggleMusic() {
    this.musicEnabled = !this.musicEnabled
    if (!this.musicEnabled) {
      this.sounds.intro?.fade(this.masterVolume * this.musicVolume, 0, 1000)
      setTimeout(() => this.sounds.intro?.stop(), 1100)
    }
    this._savePreferences()
    return this.musicEnabled
  }

  isMusicEnabled() {
    return this.musicEnabled
  }

  mute(names) {
    names.forEach(name => this.mutedSounds.add(name))
  }

  unmute(names) {
    names.forEach(name => this.mutedSounds.delete(name))
  }

  toggleMute() {
    this.allMuted = !this.allMuted
    Howler.mute(this.allMuted)
    this._savePreferences()
    return this.allMuted
  }

  isMuted() {
    return this.allMuted
  }

  setVolume(vol) {
    this.masterVolume = Math.max(0, Math.min(1, vol))
    Howler.volume(this.masterVolume)
    this._savePreferences()
  }

  setMasterVolume(vol) {
    this.setVolume(vol)
    this._applyMusicRuntimeVolume()
  }

  setSfxVolume(vol) {
    this.sfxVolume = Math.max(0, Math.min(1, vol))
    this._savePreferences()
  }

  setMusicVolume(vol) {
    this.musicVolume = Math.max(0, Math.min(1, vol))
    this._applyMusicRuntimeVolume()
    this._savePreferences()
  }

  getMasterVolume() {
    return this.masterVolume
  }

  getSfxVolume() {
    return this.sfxVolume
  }

  getMusicVolume() {
    return this.musicVolume
  }

  duckMusic(scale = 0.6, durationMs = 250) {
    const music = this.sounds.intro
    if (!music || !music.playing()) return
    const base = this.masterVolume * this.musicVolume
    const ducked = Math.max(0, base * scale)
    music.fade(music.volume(), ducked, 90)
    clearTimeout(this._musicDuckTimer)
    this._musicDuckTimer = setTimeout(() => {
      music.fade(music.volume(), base, durationMs)
      this._musicDuckTimer = null
    }, 110)
  }

  _applyMusicRuntimeVolume() {
    const music = this.sounds.intro
    if (!music || !music.playing()) return
    const target = this.masterVolume * this.musicVolume
    music.volume(target)
  }
}

export const Sounds = new SoundsManager()
