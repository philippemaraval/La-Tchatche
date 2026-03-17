import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Howl } from 'howler'
import { latLngBounds } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { QRCodeSVG } from 'qrcode.react'
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet'
import {
  Compass,
  Download,
  Heart,
  LocateFixed,
  MapPinned,
  Pause,
  Play,
  Quote,
  Search,
  Share2,
  X,
} from 'lucide-react'
import laTchatcheLogo from './assets/la-tchatche-logo.png'
import {
  OFFLINE_AUDIO_CACHE_KEY,
  calculatePlaybackProgress,
  computeResumePosition,
  formatAudioTime,
  seekFromProgress,
  shiftSeekPosition,
  shouldClearStoredPosition,
} from './features/audio'
import { buildEpisodeHash, parseEpisodeHash } from './features/deeplink/hashDeepLink'
import {
  LEXICON,
  MARSEILLE_BOUNDS,
  MARSEILLE_CENTER,
  MAX_BATCHES,
  NAV_ITEMS,
  buildEpisodeBatch,
} from './features/episodes/catalog'
import { submitSuggestionWithFallback } from './features/suggestions/suggestionService'
import { parseStoredJson } from './lib/storage'
import { useAccessibleModal } from './lib/useAccessibleModal'
const FAVORITES_KEY = 'la-tchatche-favoris'
const PLAYBACK_POSITIONS_KEY = 'la-tchatche-playback-positions'
const PLAYBACK_RATE_KEY = 'la-tchatche-playback-rate'
const OFFLINE_EPISODES_KEY = 'la-tchatche-offline-episodes'
const SUGGESTIONS_KEY = 'la-tchatche-suggestions'
const SUGGESTIONS_API_ENDPOINT = import.meta.env.VITE_SUGGESTIONS_API_URL || '/api/suggestions'
const PLAYBACK_RATE_OPTIONS = [0.8, 1, 1.2, 1.5]
const MotionSection = motion.section
const MotionArticle = motion.article
const MotionDiv = motion.div
const MotionSpan = motion.span

function FitMapBounds({ points, userPosition }) {
  const map = useMap()

  useEffect(() => {
    const coordinates = points.map((point) => [point.lat, point.lng])

    if (userPosition) {
      coordinates.push([userPosition.lat, userPosition.lng])
    }

    if (coordinates.length === 0) {
      map.setView(MARSEILLE_CENTER, 12, { animate: false })
      return
    }

    if (coordinates.length === 1) {
      map.setView(coordinates[0], 14, { animate: false })
      return
    }

    map.fitBounds(latLngBounds(coordinates).pad(0.28), { animate: false })
  }, [map, points, userPosition])

  return null
}

function haversineDistanceKm(lat1, lon1, lat2, lon2) {
  const radius = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function WaveformCanvas({ active, playing, progress }) {
  const canvasRef = useRef(null)
  const rafRef = useRef(0)
  const phaseRef = useRef(0)

  useEffect(() => {
    const draw = (phase) => {
      const canvas = canvasRef.current
      if (!canvas) {
        return
      }

      const bounds = canvas.getBoundingClientRect()
      const width = Math.max(1, Math.floor(bounds.width))
      const height = Math.max(1, Math.floor(bounds.height))
      const dpr = window.devicePixelRatio || 1

      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr
        canvas.height = height * dpr
      }

      const ctx = canvas.getContext('2d')
      if (!ctx) {
        return
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, width, height)

      const bars = Math.max(42, Math.floor(width / 6))
      const gap = 2
      const barWidth = Math.max(1, (width - gap * (bars - 1)) / bars)
      const centerY = height / 2
      const playedUntil = (width * progress) / 100

      for (let i = 0; i < bars; i += 1) {
        const x = i * (barWidth + gap)
        const harmonic =
          Math.abs(
            Math.sin(i * 0.42 + phase * 0.07) +
              0.6 * Math.sin(i * 0.11 + phase * 0.03) +
              0.35 * Math.cos(i * 0.06 + phase * 0.05),
          ) / 2

        const movement = playing && active ? 0.2 * Math.sin(phase * 0.1 + i * 0.9) : 0
        const amplitude = Math.max(0.12, Math.min(0.94, harmonic + movement))
        const barHeight = Math.max(5, amplitude * (height * 0.88))
        const y = centerY - barHeight / 2

        const isPlayed = x <= playedUntil
        const alpha = isPlayed ? 0.9 : 0.45
        ctx.fillStyle = isPlayed ? `rgba(178, 34, 34, ${alpha})` : 'rgba(114, 47, 47, 0.4)'
        ctx.fillRect(x, y, barWidth, barHeight)
      }

      const lineGradient = ctx.createLinearGradient(0, centerY, width, centerY)
      lineGradient.addColorStop(0, 'rgba(178, 34, 34, 0.2)')
      lineGradient.addColorStop(progress / 100, 'rgba(178, 34, 34, 0.8)')
      lineGradient.addColorStop(1, 'rgba(100, 100, 100, 0.25)')
      ctx.fillStyle = lineGradient
      ctx.fillRect(0, centerY - 0.5, width, 1)
    }

    const loop = () => {
      phaseRef.current += active && playing ? 1.5 : 0.3
      draw(phaseRef.current)
      if (active && playing) {
        rafRef.current = requestAnimationFrame(loop)
      }
    }

    draw(phaseRef.current)

    if (active && playing) {
      rafRef.current = requestAnimationFrame(loop)
    }

    return () => {
      cancelAnimationFrame(rafRef.current)
    }
  }, [active, playing, progress])

  return <canvas ref={canvasRef} className="h-32 w-full rounded-xl md:h-36" aria-hidden="true" />
}

function App() {
  const [episodes, setEpisodes] = useState(() => buildEpisodeBatch(0, 8))
  const [viewMode, setViewMode] = useState('feed')
  const [selectedNav, setSelectedNav] = useState(null)
  const [mapCategory, setMapCategory] = useState(null)
  const [query, setQuery] = useState('')
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  const [durationFilter, setDurationFilter] = useState('all')
  const [locationFilter, setLocationFilter] = useState('all')
  const [keywordFilter, setKeywordFilter] = useState('all')
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)

  const [favorites, setFavorites] = useState(() => {
    const parsed = parseStoredJson(FAVORITES_KEY, [])
    return Array.isArray(parsed) ? parsed : []
  })

  const favoriteSet = useMemo(() => new Set(favorites), [favorites])

  const [openLexeme, setOpenLexeme] = useState(null)
  const [quoteModal, setQuoteModal] = useState({ open: false, episode: null })
  const [quoteStart, setQuoteStart] = useState(0)
  const [quoteLength, setQuoteLength] = useState(20)
  const [quoteCopied, setQuoteCopied] = useState(false)

  const [geoStatus, setGeoStatus] = useState('idle')
  const [geoError, setGeoError] = useState('')
  const [userPosition, setUserPosition] = useState(null)
  const [mapMode, setMapMode] = useState('all')
  const [selectedMapEpisodeId, setSelectedMapEpisodeId] = useState(null)

  const [activeEpisodeId, setActiveEpisodeId] = useState(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [trackDuration, setTrackDuration] = useState(0)
  const [transitioning, setTransitioning] = useState(false)
  const [audioError, setAudioError] = useState('')
  const [playbackRate, setPlaybackRate] = useState(() => {
    const stored = Number(localStorage.getItem(PLAYBACK_RATE_KEY))
    return PLAYBACK_RATE_OPTIONS.includes(stored) ? stored : 1
  })
  const [playbackPositions, setPlaybackPositions] = useState(() => {
    const parsed = parseStoredJson(PLAYBACK_POSITIONS_KEY, {})
    return parsed && typeof parsed === 'object' ? parsed : {}
  })
  const [offlineEpisodeIds, setOfflineEpisodeIds] = useState(() => {
    const parsed = parseStoredJson(OFFLINE_EPISODES_KEY, [])
    return Array.isArray(parsed) ? parsed : []
  })
  const [offlineBusyId, setOfflineBusyId] = useState(null)
  const [suggestModalOpen, setSuggestModalOpen] = useState(false)
  const [suggestionSent, setSuggestionSent] = useState('')
  const [suggestSubmitting, setSuggestSubmitting] = useState(false)
  const [activeHash, setActiveHash] = useState(() =>
    typeof window === 'undefined' ? '' : window.location.hash,
  )
  const [suggestForm, setSuggestForm] = useState({
    name: '',
    email: '',
    category: NAV_ITEMS[0],
    location: '',
    pitch: '',
  })

  const loadMoreRef = useRef(null)
  const pageRef = useRef(1)
  const progressTimerRef = useRef(null)
  const timeoutRef = useRef(null)
  const transitionTokenRef = useRef(0)
  const howlRef = useRef(null)
  const audioContextRef = useRef(null)
  const bridgeStopRef = useRef(null)
  const lastPositionWriteRef = useRef({ episodeId: null, second: -1 })
  const lastAppliedHashRef = useRef('')
  const pendingScrollSlugRef = useRef(null)

  const suggestDialogTitleId = useId()
  const quoteDialogTitleId = useId()
  const closeSuggestModal = useCallback(() => {
    setSuggestModalOpen(false)
  }, [])
  const closeQuoteModal = useCallback(() => {
    setQuoteModal({ open: false, episode: null })
    setQuoteCopied(false)
  }, [])
  const { dialogRef: suggestDialogRef, initialFocusRef: suggestInitialFocusRef } = useAccessibleModal({
    open: suggestModalOpen,
    onClose: closeSuggestModal,
  })
  const { dialogRef: quoteDialogRef, initialFocusRef: quoteInitialFocusRef } = useAccessibleModal({
    open: quoteModal.open,
    onClose: closeQuoteModal,
  })

  useEffect(() => {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites))
  }, [favorites])

  useEffect(() => {
    localStorage.setItem(PLAYBACK_RATE_KEY, String(playbackRate))
    if (howlRef.current) {
      howlRef.current.rate(playbackRate)
    }
  }, [playbackRate])

  useEffect(() => {
    localStorage.setItem(PLAYBACK_POSITIONS_KEY, JSON.stringify(playbackPositions))
  }, [playbackPositions])

  useEffect(() => {
    localStorage.setItem(OFFLINE_EPISODES_KEY, JSON.stringify(offlineEpisodeIds))
  }, [offlineEpisodeIds])

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current)
      }
      if (bridgeStopRef.current) {
        bridgeStopRef.current()
      }
      if (howlRef.current) {
        howlRef.current.stop()
        howlRef.current.unload()
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close()
      }
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined
    }

    const syncHash = () => {
      setActiveHash(window.location.hash)
    }

    syncHash()
    window.addEventListener('hashchange', syncHash)

    return () => {
      window.removeEventListener('hashchange', syncHash)
    }
  }, [])

  useEffect(() => {
    if (!pendingScrollSlugRef.current) {
      return
    }

    const targetSlug = pendingScrollSlugRef.current
    const timer = window.setTimeout(() => {
      const targetNode = document.querySelector(`[data-episode-slug="${targetSlug}"]`)
      if (targetNode instanceof HTMLElement) {
        targetNode.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
      pendingScrollSlugRef.current = null
    }, 30)

    return () => {
      window.clearTimeout(timer)
    }
  }, [episodes, viewMode])

  const stopProgressTicker = () => {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current)
      progressTimerRef.current = null
    }
  }

  const persistPlaybackPosition = useCallback((episodeId, seconds, duration = 0) => {
    if (!episodeId) {
      return
    }

    const safeSecond = Math.max(0, Math.floor(seconds || 0))
    const safeDuration = Math.max(0, Number(duration) || 0)
    const shouldClear = shouldClearStoredPosition(safeSecond, safeDuration)

    setPlaybackPositions((current) => {
      const next = { ...current }
      if (shouldClear) {
        delete next[episodeId]
      } else {
        next[episodeId] = safeSecond
      }
      return next
    })
  }, [])

  const seekRelative = (deltaSeconds) => {
    const currentHowl = howlRef.current
    if (!currentHowl || !activeEpisodeId) {
      return
    }

    const currentSeek = typeof currentHowl.seek() === 'number' ? currentHowl.seek() : 0
    const totalDuration = currentHowl.duration() || trackDuration || 0
    const nextSeek = shiftSeekPosition(currentSeek, deltaSeconds, totalDuration)
    currentHowl.seek(nextSeek)
    setCurrentTime(nextSeek)
    if (totalDuration > 0) {
      setTrackDuration(totalDuration)
      const { percent } = calculatePlaybackProgress(nextSeek, totalDuration)
      setProgress(percent)
    }
    persistPlaybackPosition(activeEpisodeId, nextSeek, totalDuration)
  }

  const startProgressTicker = (howl, fallbackDuration, episodeId) => {
    stopProgressTicker()
    progressTimerRef.current = setInterval(() => {
      if (!howl.playing()) {
        return
      }

      const seek = typeof howl.seek() === 'number' ? howl.seek() : 0
      const duration = howl.duration() || fallbackDuration || 0

      setCurrentTime(seek)
      setTrackDuration(duration)
      const { percent } = calculatePlaybackProgress(seek, duration)
      setProgress(percent)
      const currentSecond = Math.floor(seek)
      if (lastPositionWriteRef.current.episodeId !== episodeId || lastPositionWriteRef.current.second !== currentSecond) {
        lastPositionWriteRef.current = { episodeId, second: currentSecond }
        persistPlaybackPosition(episodeId, seek, duration || fallbackDuration)
      }
    }, 180)
  }

  const runAmbientBridge = (durationMs = 5000) => {
    if (typeof window === 'undefined') {
      return Promise.resolve()
    }

    const AudioCtx = window.AudioContext || window.webkitAudioContext
    if (!AudioCtx) {
      return new Promise((resolve) => {
        setTimeout(resolve, durationMs)
      })
    }

    if (!audioContextRef.current) {
      audioContextRef.current = new AudioCtx()
    }

    const context = audioContextRef.current
    if (context.state === 'suspended') {
      context.resume().catch(() => {})
    }

    return new Promise((resolve) => {
      let finished = false
      const nodes = []
      const timers = []

      const finish = () => {
        if (finished) {
          return
        }
        finished = true

        for (const timer of timers) {
          clearInterval(timer)
          clearTimeout(timer)
        }

        for (const node of nodes) {
          try {
            if (node.stop) {
              node.stop()
            }
          } catch {
            // no-op
          }
          try {
            node.disconnect()
          } catch {
            // no-op
          }
        }

        bridgeStopRef.current = null
        resolve()
      }

      bridgeStopRef.current = finish

      const master = context.createGain()
      master.gain.value = 0.1
      master.connect(context.destination)
      nodes.push(master)

      const windFilter = context.createBiquadFilter()
      windFilter.type = 'bandpass'
      windFilter.frequency.value = 900
      windFilter.Q.value = 0.6
      windFilter.connect(master)
      nodes.push(windFilter)

      const noiseBuffer = context.createBuffer(1, context.sampleRate, context.sampleRate)
      const channelData = noiseBuffer.getChannelData(0)
      for (let i = 0; i < channelData.length; i += 1) {
        channelData[i] = Math.random() * 2 - 1
      }

      const windSource = context.createBufferSource()
      windSource.buffer = noiseBuffer
      windSource.loop = true
      windSource.connect(windFilter)
      windSource.start()
      nodes.push(windSource)

      const lfo = context.createOscillator()
      lfo.frequency.value = 0.08
      const lfoGain = context.createGain()
      lfoGain.gain.value = 280
      lfo.connect(lfoGain)
      lfoGain.connect(windFilter.frequency)
      lfo.start()
      nodes.push(lfo)
      nodes.push(lfoGain)

      const gullLoop = setInterval(() => {
        const chirpOsc = context.createOscillator()
        const chirpGain = context.createGain()

        chirpOsc.type = 'sine'
        chirpOsc.frequency.setValueAtTime(1100, context.currentTime)
        chirpOsc.frequency.exponentialRampToValueAtTime(1700, context.currentTime + 0.14)
        chirpOsc.frequency.exponentialRampToValueAtTime(900, context.currentTime + 0.33)

        chirpGain.gain.setValueAtTime(0.0001, context.currentTime)
        chirpGain.gain.exponentialRampToValueAtTime(0.04, context.currentTime + 0.05)
        chirpGain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.36)

        chirpOsc.connect(chirpGain)
        chirpGain.connect(master)
        chirpOsc.start()
        chirpOsc.stop(context.currentTime + 0.38)

        nodes.push(chirpOsc)
        nodes.push(chirpGain)
      }, 1500)
      timers.push(gullLoop)

      const doneTimer = setTimeout(() => {
        master.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.25)
        const endTimer = setTimeout(finish, 280)
        timers.push(endTimer)
      }, durationMs)

      timers.push(doneTimer)
    })
  }

  const loadMoreEpisodes = useCallback(() => {
    if (loadingMore || !hasMore) {
      return
    }

    setLoadingMore(true)
    timeoutRef.current = setTimeout(() => {
      const nextPage = pageRef.current
      const nextBatch = buildEpisodeBatch(nextPage, 4)

      setEpisodes((current) => [...current, ...nextBatch])
      pageRef.current += 1
      if (pageRef.current >= MAX_BATCHES) {
        setHasMore(false)
      }
      setLoadingMore(false)
    }, 700)
  }, [hasMore, loadingMore])

  useEffect(() => {
    if (viewMode !== 'feed') {
      return
    }

    if (!hasMore || !loadMoreRef.current) {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries
        if (entry.isIntersecting) {
          loadMoreEpisodes()
        }
      },
      { rootMargin: '1000px 0px' },
    )

    observer.observe(loadMoreRef.current)

    return () => {
      observer.disconnect()
    }
  }, [hasMore, loadMoreEpisodes, viewMode])

  const locationOptions = useMemo(() => {
    return Array.from(new Set(episodes.map((episode) => episode.location.label))).sort((a, b) =>
      a.localeCompare(b, 'fr'),
    )
  }, [episodes])

  const keywordOptions = useMemo(() => {
    return Array.from(new Set(episodes.flatMap((episode) => episode.keywords))).sort((a, b) =>
      a.localeCompare(b, 'fr'),
    )
  }, [episodes])

  const searchedEpisodes = useMemo(() => {
    const search = query.trim().toLowerCase()

    return episodes.filter((episode) => {
      if (durationFilter === 'short' && episode.duration > 220) {
        return false
      }
      if (durationFilter === 'medium' && (episode.duration <= 220 || episode.duration > 245)) {
        return false
      }
      if (durationFilter === 'long' && episode.duration <= 245) {
        return false
      }
      if (locationFilter !== 'all' && episode.location.label !== locationFilter) {
        return false
      }
      if (keywordFilter !== 'all' && !episode.keywords.includes(keywordFilter)) {
        return false
      }
      if (!search) {
        return true
      }

      const haystack = `${episode.title} ${episode.summary} ${episode.category} ${episode.location.label}`.toLowerCase()
      return haystack.includes(search)
    })
  }, [durationFilter, episodes, keywordFilter, locationFilter, query])

  const filteredEpisodes = useMemo(() => {
    if (!selectedNav) {
      return searchedEpisodes
    }

    return searchedEpisodes.filter((episode) => episode.category === selectedNav)
  }, [searchedEpisodes, selectedNav])

  const mapFilteredEpisodes = useMemo(() => {
    if (!mapCategory) {
      return searchedEpisodes
    }

    return searchedEpisodes.filter((episode) => episode.category === mapCategory)
  }, [mapCategory, searchedEpisodes])

  const nearestEpisodes = useMemo(() => {
    if (!userPosition) {
      return []
    }

    return mapFilteredEpisodes
      .map((episode) => ({
        ...episode,
        distance: haversineDistanceKm(
          userPosition.lat,
          userPosition.lng,
          episode.location.lat,
          episode.location.lng,
        ),
      }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 5)
  }, [mapFilteredEpisodes, userPosition])

  const latestEpisodes = useMemo(() => mapFilteredEpisodes.slice(-5).reverse(), [mapFilteredEpisodes])
  const nearestEpisodeIds = useMemo(() => new Set(nearestEpisodes.map((episode) => episode.id)), [nearestEpisodes])
  const latestEpisodeIds = useMemo(() => new Set(latestEpisodes.map((episode) => episode.id)), [latestEpisodes])
  const nearestDistanceById = useMemo(
    () => new Map(nearestEpisodes.map((episode) => [episode.id, episode.distance])),
    [nearestEpisodes],
  )
  const isNearestModeActive = mapMode === 'nearest' && Boolean(userPosition)

  const focusedEpisodeIds = useMemo(() => {
    if (mapMode === 'all') {
      return new Set(mapFilteredEpisodes.map((episode) => episode.id))
    }

    if (mapMode === 'latest') {
      return latestEpisodeIds
    }

    if (mapMode === 'nearest') {
      return isNearestModeActive ? nearestEpisodeIds : new Set()
    }

    return new Set()
  }, [isNearestModeActive, latestEpisodeIds, mapFilteredEpisodes, mapMode, nearestEpisodeIds])

  const mapEpisodes = mapFilteredEpisodes

  const mapPoints = useMemo(
    () =>
      mapEpisodes.map((episode) => ({
        id: episode.id,
        title: episode.title,
        category: episode.category,
        locationLabel: episode.location.label,
        lat: episode.location.lat,
        lng: episode.location.lng,
        active: focusedEpisodeIds.has(episode.id),
        episode,
      })),
    [focusedEpisodeIds, mapEpisodes],
  )

  const selectedMapEpisode = useMemo(
    () => mapEpisodes.find((episode) => episode.id === selectedMapEpisodeId) || null,
    [mapEpisodes, selectedMapEpisodeId],
  )

  const activeEpisode = useMemo(
    () => episodes.find((episode) => episode.id === activeEpisodeId) || null,
    [activeEpisodeId, episodes],
  )
  const offlineEpisodeSet = useMemo(() => new Set(offlineEpisodeIds), [offlineEpisodeIds])

  const playEpisode = async (episode) => {
    setAudioError('')
    const current = howlRef.current
    const resumeAt = computeResumePosition(playbackPositions[episode.id], episode.duration)

    if (activeEpisodeId === episode.id && current) {
      if (current.playing()) {
        const pausedAt = typeof current.seek() === 'number' ? current.seek() : 0
        persistPlaybackPosition(episode.id, pausedAt, current.duration() || episode.duration)
        current.pause()
        setIsPlaying(false)
        stopProgressTicker()
      } else {
        current.rate(playbackRate)
        current.play()
        setIsPlaying(true)
        startProgressTicker(current, episode.duration, episode.id)
      }
      return
    }

    transitionTokenRef.current += 1
    const token = transitionTokenRef.current

    if (bridgeStopRef.current) {
      bridgeStopRef.current()
    }

    if (current) {
      if (activeEpisodeId) {
        const previousAt = typeof current.seek() === 'number' ? current.seek() : 0
        persistPlaybackPosition(activeEpisodeId, previousAt, current.duration() || trackDuration)
      }
      setTransitioning(true)
      current.fade(current.volume(), 0.0, 220)
      setTimeout(() => {
        if (current === howlRef.current) {
          current.stop()
          current.unload()
          howlRef.current = null
        }
      }, 240)
      stopProgressTicker()
      await runAmbientBridge(5000)
      if (transitionTokenRef.current !== token) {
        return
      }
    }

    setTransitioning(false)
    setActiveEpisodeId(episode.id)
    setCurrentTime(0)
    setProgress(0)
    setTrackDuration(episode.duration)

    let resumeApplied = false
    const next = new Howl({
      src: [episode.audioUrl],
      html5: true,
      volume: 0.95,
      rate: playbackRate,
      onload: () => {
        setTrackDuration(next.duration() || episode.duration)
      },
      onplay: () => {
        if (!resumeApplied && resumeAt > 1) {
          resumeApplied = true
          next.seek(resumeAt)
          const total = next.duration() || episode.duration
          setCurrentTime(resumeAt)
          setTrackDuration(total)
          const { percent } = calculatePlaybackProgress(resumeAt, total)
          setProgress(percent)
        }
        setIsPlaying(true)
        startProgressTicker(next, episode.duration, episode.id)
      },
      onpause: () => {
        const pausedAt = typeof next.seek() === 'number' ? next.seek() : 0
        persistPlaybackPosition(episode.id, pausedAt, next.duration() || episode.duration)
        setIsPlaying(false)
      },
      onstop: () => {
        const stoppedAt = typeof next.seek() === 'number' ? next.seek() : 0
        persistPlaybackPosition(episode.id, stoppedAt, next.duration() || episode.duration)
        setIsPlaying(false)
      },
      onend: () => {
        persistPlaybackPosition(episode.id, 0, next.duration() || episode.duration)
        setIsPlaying(false)
        stopProgressTicker()
        setProgress(0)
        setCurrentTime(0)
      },
      onloaderror: () => {
        setAudioError('Lecture indisponible pour cet episode.')
      },
      onplayerror: () => {
        setAudioError('Interaction requise pour demarrer l audio.')
      },
    })

    howlRef.current = next
    next.rate(playbackRate)
    next.play()
  }

  const requestGeo = () => {
    if (!navigator.geolocation) {
      setGeoStatus('error')
      setGeoError('Geolocalisation non supportee par ce navigateur.')
      return
    }

    setGeoStatus('pending')
    setGeoError('')

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGeoStatus('ready')
        setUserPosition({ lat: position.coords.latitude, lng: position.coords.longitude })
      },
      () => {
        setGeoStatus('error')
        setGeoError('Position indisponible. Autorise la geolocalisation pour activer la carte.')
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
      },
    )
  }

  const toggleFavorite = (episodeId) => {
    setFavorites((current) =>
      current.includes(episodeId) ? current.filter((id) => id !== episodeId) : [...current, episodeId],
    )
  }

  const toggleOfflineEpisode = async (episode) => {
    if (!('caches' in window)) {
      setAudioError('Mode hors ligne non supporte sur cet appareil.')
      return
    }

    setOfflineBusyId(episode.id)
    setAudioError('')

    try {
      const cache = await caches.open(OFFLINE_AUDIO_CACHE_KEY)
      const request = new Request(episode.audioUrl, { mode: 'no-cors' })

      if (offlineEpisodeSet.has(episode.id)) {
        await cache.delete(request, { ignoreSearch: true })
        setOfflineEpisodeIds((current) => current.filter((id) => id !== episode.id))
        return
      }

      const response = await fetch(request)
      if (!response || (!response.ok && response.type !== 'opaque')) {
        throw new Error('offline-download-failed')
      }

      await cache.put(request, response.clone())
      setOfflineEpisodeIds((current) => (current.includes(episode.id) ? current : [...current, episode.id]))
    } catch {
      setAudioError('Impossible de preparer cet episode hors ligne pour le moment.')
    } finally {
      setOfflineBusyId(null)
    }
  }

  const submitSuggestion = async (event) => {
    event.preventDefault()
    setSuggestionSent('')
    setSuggestSubmitting(true)

    try {
      const result = await submitSuggestionWithFallback({
        form: suggestForm,
        endpoint: SUGGESTIONS_API_ENDPOINT,
        localStorageKey: SUGGESTIONS_KEY,
      })

      if (!result.ok) {
        setSuggestionSent(result.message || 'Envoi indisponible pour le moment. Reessaye plus tard.')
        return
      }

      const sourceLabel = result.source === 'api' ? 'transmise' : 'enregistree localement'
      setSuggestionSent(`Merci ${result.payload.name}, proposition ${sourceLabel} (${result.id}).`)
      setSuggestForm({
        name: '',
        email: '',
        category: NAV_ITEMS[0],
        location: '',
        pitch: '',
      })
    } finally {
      setSuggestSubmitting(false)
    }
  }

  const openQuoteModal = (episode) => {
    setQuoteModal({ open: true, episode })
    const start = activeEpisodeId === episode.id ? Math.floor(currentTime) : 0
    setQuoteStart(start)
    setQuoteLength(20)
    setQuoteCopied(false)
  }

  const quoteDurationBase = quoteModal.episode ? quoteModal.episode.duration : 30
  const quoteMaxStart = Math.max(0, quoteDurationBase - 15)
  const quoteMaxLength = Math.min(30, Math.max(15, quoteDurationBase - quoteStart))
  const quoteEnd = Math.min(quoteDurationBase, quoteStart + quoteLength)
  const resolveEpisodeUrl = useCallback((episodeSlug, startSeconds, durationSeconds) => {
    const hash = buildEpisodeHash({ episodeSlug, startSeconds, durationSeconds })
    if (typeof window === 'undefined') {
      return hash
    }

    return `${window.location.origin}/${hash}`
  }, [])

  const quoteLink = useMemo(() => {
    if (!quoteModal.episode) {
      return ''
    }

    return resolveEpisodeUrl(quoteModal.episode.slug, Math.floor(quoteStart), Math.floor(quoteLength))
  }, [quoteLength, quoteModal.episode, quoteStart, resolveEpisodeUrl])

  const copyQuote = async () => {
    if (!quoteModal.episode) {
      return
    }

    const payload = `${quoteModal.episode.title} [${formatAudioTime(quoteStart)} - ${formatAudioTime(quoteEnd)}] ${quoteLink}`

    try {
      await navigator.clipboard.writeText(payload)
      setQuoteCopied(true)
    } catch {
      setQuoteCopied(false)
    }
  }

  useEffect(() => {
    const parsed = parseEpisodeHash(activeHash)

    if (!parsed) {
      lastAppliedHashRef.current = ''
      return
    }

    if (lastAppliedHashRef.current === parsed.rawHash) {
      return
    }

    const targetEpisode = episodes.find((episode) => episode.slug === parsed.episodeSlug)
    if (!targetEpisode) {
      return
    }

    lastAppliedHashRef.current = parsed.rawHash
    pendingScrollSlugRef.current = parsed.episodeSlug

    setViewMode('feed')
    setSelectedNav(null)
    setMapCategory(null)
    setMapMode('all')
    setSelectedMapEpisodeId(null)

    if (parsed.hasStart) {
      persistPlaybackPosition(targetEpisode.id, parsed.startSeconds, targetEpisode.duration)
      setPlaybackPositions((current) => ({
        ...current,
        [targetEpisode.id]: parsed.startSeconds,
      }))

      if (activeEpisodeId === targetEpisode.id && howlRef.current) {
        const total = howlRef.current.duration() || targetEpisode.duration
        const nextSeek = computeResumePosition(parsed.startSeconds, total, { tailPaddingSeconds: 0 })
        howlRef.current.seek(nextSeek)
        setCurrentTime(nextSeek)
        setTrackDuration(total)
        const { percent } = calculatePlaybackProgress(nextSeek, total)
        setProgress(percent)
      }
    }

    if (parsed.hasDuration) {
      setQuoteModal({ open: true, episode: targetEpisode })
      setQuoteStart(parsed.startSeconds)
      setQuoteLength(parsed.durationSeconds)
      setQuoteCopied(false)
    }
  }, [activeEpisodeId, activeHash, episodes, persistPlaybackPosition])

  const renderSummary = (episode) => {
    const parts = episode.summary.split(/(\[\[[^\]]+\]\])/g).filter(Boolean)

    return parts.map((part, index) => {
      if (!part.startsWith('[[') || !part.endsWith(']]')) {
        return <span key={`${episode.id}-txt-${index}`}>{part}</span>
      }

      const raw = part.slice(2, -2)
      const key = raw.trim().toLowerCase()
      const definition = LEXICON[key]
      const isOpen =
        openLexeme && openLexeme.episodeId === episode.id && openLexeme.keyword.toLowerCase() === key

      if (!definition) {
        return <span key={`${episode.id}-plain-${index}`}>{raw}</span>
      }

      return (
        <span key={`${episode.id}-word-${index}`} className="relative inline-block">
          <button
            type="button"
            className="opera-underline text-left text-mist/95 transition-colors hover:text-operaSoft"
            onMouseEnter={() => setOpenLexeme({ episodeId: episode.id, keyword: raw })}
            onMouseLeave={() => setOpenLexeme(null)}
            onClick={() =>
              setOpenLexeme((current) =>
                current && current.episodeId === episode.id && current.keyword === raw
                  ? null
                  : { episodeId: episode.id, keyword: raw },
              )
            }
          >
            {raw}
          </button>

          <AnimatePresence>
            {isOpen && (
              <MotionSpan
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                transition={{ duration: 0.16 }}
                className="lexeme-tooltip absolute left-0 top-[130%] z-20 w-64 rounded-xl px-3 py-2 text-xs leading-relaxed text-mist"
              >
                {definition}
              </MotionSpan>
            )}
          </AnimatePresence>
        </span>
      )
    })
  }

  return (
    <div className="bitume-noise min-h-screen pb-36 text-mist">
      <header className="frosted-header sticky top-0 z-40 border-b border-anthracite/90 bg-bitume/88">
        <div className="mx-auto grid w-full max-w-[1360px] gap-4 px-4 py-3 md:grid-cols-[1fr_auto_1fr] md:items-center md:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              aria-label="Retour à l'accueil"
              className="rounded-sm transition hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-opera/55"
              onClick={() => {
                setViewMode('feed')
                setSelectedNav(null)
                setMapCategory(null)
                setMapMode('all')
                setSelectedMapEpisodeId(null)
              }}
            >
              <img
                src={laTchatcheLogo}
                alt="Logo La Tchatche"
                className="h-14 w-auto rounded-sm object-contain shadow-[0_12px_28px_rgba(0,0,0,0.5)] md:h-16"
              />
            </button>
          </div>

          <div className="mobile-scroll flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-anthracite/80 bg-asphalt/60 px-3 py-2 shadow-glass md:justify-self-center md:rounded-full md:flex-nowrap">
            <button
              type="button"
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold tracking-[0.12em] transition ${
                viewMode === 'map'
                  ? 'border-opera/80 bg-opera/20 text-operaSoft'
                  : 'border-anthracite bg-transparent text-mist/80 hover:border-opera/55 hover:text-operaSoft'
              }`}
              onClick={() => {
                if (viewMode === 'map') {
                  setViewMode('feed')
                  setMapCategory(null)
                  setMapMode('all')
                  setSelectedMapEpisodeId(null)
                } else {
                  setViewMode('map')
                  setSelectedNav(null)
                  setMapCategory(null)
                  setMapMode('all')
                  setSelectedMapEpisodeId(null)
                  if (!userPosition && geoStatus === 'idle') {
                    requestGeo()
                  }
                }
              }}
            >
              <MapPinned className="h-3.5 w-3.5" />
              CARTE
            </button>

            {NAV_ITEMS.map((item, index) => (
              <div key={item} className="flex items-center">
                <button
                  type="button"
                  data-active={selectedNav === item}
                  className={`category-pill text-xs font-medium transition ${
                    selectedNav === item ? 'text-operaSoft' : 'text-mist/76 hover:text-operaSoft'
                  }`}
                  onClick={() => {
                    setViewMode('feed')
                    setMapCategory(null)
                    setMapMode('all')
                    setSelectedMapEpisodeId(null)
                    setSelectedNav((current) => (current === item ? null : item))
                  }}
                >
                  {item}
                </button>
                {index < NAV_ITEMS.length - 1 && <span className="px-1 text-anthracite">|</span>}
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 md:justify-self-end">
            <label className="flex items-center gap-2 rounded-full border border-anthracite/80 bg-black/25 px-3 py-2 shadow-glass">
              <Search className="h-4 w-4 text-mist/65" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="w-full bg-transparent text-sm text-mist placeholder:text-mist/45 focus:outline-none md:w-52"
                placeholder="Rechercher"
                aria-label="Rechercher un épisode"
                type="search"
              />
            </label>
            <button
              type="button"
              className={`rounded-full border px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.1em] transition ${
                showAdvancedFilters
                  ? 'border-opera/60 bg-opera/12 text-operaSoft'
                  : 'border-anthracite/70 bg-black/20 text-mist/70 hover:border-opera/45 hover:text-operaSoft'
              }`}
              onClick={() => setShowAdvancedFilters((current) => !current)}
            >
              Filtres
            </button>
          </div>
        </div>

        {showAdvancedFilters && (
          <div className="mx-auto w-full max-w-[1360px] px-4 pb-3 md:px-6">
            <div className="grid gap-2 rounded-2xl border border-anthracite/80 bg-black/25 p-3 md:grid-cols-[1fr_1fr_1fr_auto] md:items-center">
              <label className="flex items-center gap-2 rounded-full border border-anthracite/75 bg-black/25 px-3 py-2 text-xs text-mist/70">
                Duree
                <select
                  value={durationFilter}
                  onChange={(event) => setDurationFilter(event.target.value)}
                  className="w-full bg-transparent text-xs text-mist focus:outline-none"
                >
                  <option value="all">Toutes</option>
                  <option value="short">Courtes (0-3m40)</option>
                  <option value="medium">Moyennes (3m41-4m05)</option>
                  <option value="long">Longues (&gt;4m05)</option>
                </select>
              </label>

              <label className="flex items-center gap-2 rounded-full border border-anthracite/75 bg-black/25 px-3 py-2 text-xs text-mist/70">
                Lieu
                <select
                  value={locationFilter}
                  onChange={(event) => setLocationFilter(event.target.value)}
                  className="w-full bg-transparent text-xs text-mist focus:outline-none"
                >
                  <option value="all">Tous</option>
                  {locationOptions.map((option) => (
                    <option key={`loc-${option}`} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex items-center gap-2 rounded-full border border-anthracite/75 bg-black/25 px-3 py-2 text-xs text-mist/70">
                Mot-cle
                <select
                  value={keywordFilter}
                  onChange={(event) => setKeywordFilter(event.target.value)}
                  className="w-full bg-transparent text-xs text-mist focus:outline-none"
                >
                  <option value="all">Tous</option>
                  {keywordOptions.map((option) => (
                    <option key={`kw-${option}`} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="button"
                className="rounded-full border border-anthracite/75 px-3 py-2 text-[11px] uppercase tracking-[0.1em] text-mist/70 transition hover:border-opera/50 hover:text-operaSoft"
                onClick={() => {
                  setDurationFilter('all')
                  setLocationFilter('all')
                  setKeywordFilter('all')
                }}
              >
                Reset
              </button>
            </div>
          </div>
        )}
      </header>

      <main className="mx-auto mt-8 w-full max-w-[860px] px-4 md:px-6">
        <h1 className="sr-only">La Tchatche, podcast marseillais geolocalise</h1>
        <AnimatePresence mode="wait">
          {viewMode === 'map' ? (
            <MotionSection
              key="map-mode"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              transition={{ duration: 0.28 }}
              className="episode-shell rounded-3xl p-5 md:p-7"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-mist/55">Mode Carte</p>
                  <h2 className="font-serif text-4xl text-opera">
                    {mapMode === 'nearest'
                      ? '5 tchatches les plus proches'
                      : mapMode === 'latest'
                        ? '5 dernières tchatches'
                        : 'Toutes les tchatches disponibles'}
                  </h2>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <div className="flex flex-wrap rounded-2xl border border-anthracite/70 bg-black/35 p-1 md:rounded-full">
                    <button
                      type="button"
                      className={`rounded-full px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] transition md:text-[11px] ${
                        mapMode === 'all'
                          ? 'bg-opera/25 text-operaSoft'
                          : 'text-mist/65 hover:bg-white/5 hover:text-mist/90'
                      }`}
                      onClick={() => setMapMode('all')}
                    >
                      Toutes
                    </button>
                    <button
                      type="button"
                      className={`rounded-full px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] transition md:text-[11px] ${
                        mapMode === 'nearest'
                          ? 'bg-opera/25 text-operaSoft'
                          : 'text-mist/65 hover:bg-white/5 hover:text-mist/90'
                      }`}
                      onClick={() => {
                        setMapMode('nearest')
                        if (!userPosition && geoStatus === 'idle') {
                          requestGeo()
                        }
                      }}
                    >
                      5 tchatches les plus proches
                    </button>
                    <button
                      type="button"
                      className={`rounded-full px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] transition md:text-[11px] ${
                        mapMode === 'latest'
                          ? 'bg-opera/25 text-operaSoft'
                          : 'text-mist/65 hover:bg-white/5 hover:text-mist/90'
                      }`}
                      onClick={() => setMapMode('latest')}
                    >
                      5 dernières tchatches
                    </button>
                  </div>

                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-full border border-opera/60 px-4 py-2 text-xs font-semibold tracking-[0.12em] text-operaSoft transition hover:bg-opera/10"
                    onClick={requestGeo}
                  >
                    <LocateFixed className="h-4 w-4" />
                    Me localiser
                  </button>
                </div>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] md:text-[11px]">
                <span className="uppercase tracking-[0.16em] text-mist/38">Filtre catégorie carte</span>
                <button
                  type="button"
                  className={`rounded-full border px-2.5 py-1 uppercase tracking-[0.08em] transition ${
                    !mapCategory
                      ? 'border-opera/40 bg-opera/10 text-operaSoft/95'
                      : 'border-mist/20 text-mist/55 hover:border-mist/35 hover:text-mist/85'
                  }`}
                  onClick={() => {
                    setMapCategory(null)
                    setSelectedMapEpisodeId(null)
                  }}
                >
                  Toutes
                </button>
                {NAV_ITEMS.map((item) => (
                  <button
                    key={`map-cat-${item}`}
                    type="button"
                    className={`rounded-full border px-2.5 py-1 uppercase tracking-[0.08em] transition ${
                      mapCategory === item
                        ? 'border-opera/40 bg-opera/10 text-operaSoft/95'
                        : 'border-mist/20 text-mist/55 hover:border-mist/35 hover:text-mist/85'
                    }`}
                    onClick={() => {
                      setMapCategory((current) => (current === item ? null : item))
                      setSelectedMapEpisodeId(null)
                    }}
                  >
                    {item}
                  </button>
                ))}
              </div>

              <div className="map-grid map-surface relative mt-5 overflow-hidden rounded-2xl border border-anthracite/80 p-1">
                <MapContainer
                  center={MARSEILLE_CENTER}
                  zoom={12}
                  minZoom={10}
                  maxZoom={17}
                  scrollWheelZoom
                  maxBounds={MARSEILLE_BOUNDS}
                  maxBoundsViscosity={1}
                  className="h-72 w-full rounded-xl"
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                    url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                    noWrap
                  />
                  <FitMapBounds points={mapPoints} userPosition={userPosition} />

                  {mapPoints.map((point) => (
                    <CircleMarker
                      key={point.id}
                      center={[point.lat, point.lng]}
                      radius={point.active ? 8 : 6}
                      pathOptions={{
                        color: point.active ? '#b22222' : '#b8b8b8',
                        fillColor: point.active ? '#b22222' : '#737373',
                        fillOpacity: point.active ? 0.9 : 0.62,
                        weight: 2,
                      }}
                      eventHandlers={{
                        click: () => {
                          setSelectedMapEpisodeId(point.id)
                        },
                      }}
                    >
                      <Popup>
                        <div className="space-y-2 text-xs">
                          <p className="text-sm font-semibold text-black">{point.title}</p>
                          <p className="uppercase tracking-[0.1em] text-black/70">
                            {point.category} | {point.locationLabel}
                          </p>
                          <button
                            type="button"
                            className="rounded-full border border-black/30 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-black transition hover:bg-black/10"
                            onClick={() => playEpisode(point.episode)}
                          >
                            Écouter
                          </button>
                        </div>
                      </Popup>
                    </CircleMarker>
                  ))}

                  {userPosition && (
                    <CircleMarker
                      center={[userPosition.lat, userPosition.lng]}
                      radius={7}
                      pathOptions={{
                        color: '#ffffff',
                        fillColor: '#101010',
                        fillOpacity: 1,
                        weight: 2,
                      }}
                    >
                      <Popup>
                        <p className="text-xs font-semibold text-black">Vous êtes ici</p>
                      </Popup>
                    </CircleMarker>
                  )}
                </MapContainer>
              </div>

              {selectedMapEpisode && (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-opera/35 bg-opera/10 px-4 py-3">
                  <div>
                    <p className="font-serif text-xl text-opera">{selectedMapEpisode.title}</p>
                    <p className="text-xs uppercase tracking-[0.12em] text-mist/60">
                      {selectedMapEpisode.category} | {selectedMapEpisode.location.label}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-full border border-opera/55 px-4 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-operaSoft transition hover:bg-opera/15"
                    onClick={() => playEpisode(selectedMapEpisode)}
                  >
                    {activeEpisodeId === selectedMapEpisode.id && isPlaying ? (
                      <Pause className="h-3.5 w-3.5" />
                    ) : (
                      <Play className="h-3.5 w-3.5" />
                    )}
                    {activeEpisodeId === selectedMapEpisode.id && isPlaying ? 'Pause' : 'Écouter'}
                  </button>
                </div>
              )}

              <div className="mt-5 space-y-3">
                {mapMode === 'nearest' && geoStatus === 'pending' && (
                  <p className="text-sm text-mist/70">Localisation en cours...</p>
                )}
                {mapMode === 'nearest' && geoStatus === 'error' && (
                  <p className="text-sm text-operaSoft">{geoError}</p>
                )}
                {mapMode === 'nearest' && !userPosition && geoStatus !== 'pending' && (
                  <p className="text-sm text-mist/70">
                    La vue 5 tchatches les plus proches est optionnelle. Sans position valide, toutes les tchatches
                    restent affichées en gris.
                  </p>
                )}
                {mapEpisodes.length === 0 && (
                  <p className="text-sm text-mist/70">Aucun episode ne correspond a ce filtre.</p>
                )}

                {mapEpisodes.map((episode) => {
                  const isFocused = focusedEpisodeIds.has(episode.id)
                  const distance = nearestDistanceById.get(episode.id)

                  return (
                    <div
                      key={`map-${episode.id}`}
                      className={`flex flex-wrap items-center justify-between gap-2 rounded-xl px-4 py-3 sm:flex-nowrap ${
                        mapMode !== 'all' && !isFocused
                          ? 'border border-mist/25 bg-black/10 text-mist/60'
                          : 'border border-anthracite/70 bg-black/20'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className={`font-serif text-xl ${mapMode !== 'all' && !isFocused ? 'text-mist/70' : 'text-opera'}`}>
                          {episode.title}
                        </p>
                        <p
                          className={`text-xs uppercase tracking-[0.15em] ${
                            mapMode !== 'all' && !isFocused ? 'text-mist/45' : 'text-mist/55'
                          }`}
                        >
                          {episode.category} | {episode.location.label}
                        </p>
                      </div>
                      {mapMode === 'nearest' && isFocused && userPosition && typeof distance === 'number' ? (
                        <span className="inline-flex items-center gap-2 rounded-full border border-opera/40 px-3 py-1 text-xs text-operaSoft">
                          <Compass className="h-3.5 w-3.5" />
                          {distance.toFixed(2)} km
                        </span>
                      ) : mapMode === 'latest' && isFocused ? (
                        <span className="inline-flex items-center gap-2 rounded-full border border-opera/35 px-3 py-1 text-xs text-operaSoft/90">
                          <MapPinned className="h-3.5 w-3.5" />
                          Récent
                        </span>
                      ) : mapMode === 'all' ? (
                        <span className="inline-flex items-center gap-2 rounded-full border border-opera/35 px-3 py-1 text-xs text-operaSoft/90">
                          <MapPinned className="h-3.5 w-3.5" />
                          Disponible
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-2 rounded-full border border-mist/30 px-3 py-1 text-xs text-mist/75">
                          <MapPinned className="h-3.5 w-3.5" />
                          Hors sélection
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </MotionSection>
          ) : (
            <MotionSection
              key="feed-mode"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              transition={{ duration: 0.24 }}
            >
              {transitioning && (
                <MotionDiv
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="mb-4 rounded-xl border border-opera/40 bg-opera/10 px-4 py-3 text-xs uppercase tracking-[0.13em] text-operaSoft"
                >
                  Transition sonore en cours: ambiance portuaire 5s
                </MotionDiv>
              )}

              {audioError && (
                <div className="mb-4 rounded-xl border border-opera/40 bg-opera/10 px-4 py-3 text-sm text-operaSoft">
                  {audioError}
                </div>
              )}

              <div className="space-y-7">
                {filteredEpisodes.map((episode, index) => {
                  const isActive = activeEpisodeId === episode.id
                  const playingThis = isActive && isPlaying
                  const shownDuration = isActive ? trackDuration || episode.duration : episode.duration
                  const shownCurrent = isActive ? currentTime : 0
                  const shownProgress = isActive ? progress : 0
                  const resumeAt = playbackPositions[episode.id] || 0
                  const isOfflineReady = offlineEpisodeSet.has(episode.id)
                  const isOfflineBusy = offlineBusyId === episode.id
                  const qrValue = resolveEpisodeUrl(episode.slug)

                  return (
                    <MotionArticle
                      key={episode.id}
                      data-episode-slug={episode.slug}
                      initial={{ opacity: 0, y: 22, filter: 'blur(4px)' }}
                      whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                      viewport={{ amount: 0.25, once: true }}
                      transition={{ duration: 0.35, delay: index % 4 === 0 ? 0 : 0.05 }}
                      className="episode-shell rounded-3xl p-5 md:p-8"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-[0.65rem] uppercase tracking-[0.2em] text-mist/55">
                            {episode.category} | {episode.location.label}
                          </p>
                          <h2 className="mt-2 font-serif text-[2.1rem] leading-[1.05] text-opera md:text-[2.6rem]">
                            {episode.title}
                          </h2>
                          {!isActive && resumeAt > 1 && (
                            <p className="mt-2 text-xs uppercase tracking-[0.12em] text-operaSoft/80">
                              Reprise dispo a {formatAudioTime(resumeAt)}
                            </p>
                          )}
                        </div>

                        <div className="hidden items-end md:flex">
                          <div className="rounded-2xl border border-anthracite/80 bg-gradient-to-b from-[#2a2a2a] to-[#161616] p-2 shadow-[0_10px_24px_rgba(0,0,0,0.45)]">
                            <div className="rounded-xl border border-anthracite/70 bg-[#cfc9bf] p-1.5 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.12)]">
                              <QRCodeSVG
                                value={qrValue}
                                size={84}
                                bgColor="#cbc5ba"
                                fgColor="#101010"
                                level="M"
                                marginSize={4}
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="wave-glow mt-6 rounded-2xl border border-anthracite/80 bg-black/30 p-3">
                        <WaveformCanvas active={isActive} playing={playingThis} progress={shownProgress} />
                      </div>

                      <div className="mt-6 grid gap-6 md:grid-cols-[1.25fr_0.75fr]">
                        <div>
                          <p className="mb-3 text-lg font-medium tracking-[0.02em] text-mist">Resume Artistique</p>
                          <p className="max-w-prose text-base leading-8 text-mist/88">{renderSummary(episode)}</p>
                        </div>
                        <div>
                          <p className="mb-3 text-sm uppercase tracking-[0.14em] text-mist/58">Lexique interactif</p>
                          <div className="flex flex-wrap gap-2">
                            {episode.keywords.map((word) => (
                              <button
                                key={`${episode.id}-kw-${word}`}
                                type="button"
                                className="rounded-full border border-anthracite/80 px-3 py-1 text-xs text-mist/80 transition hover:border-opera/65 hover:text-operaSoft"
                                onClick={() => setOpenLexeme({ episodeId: episode.id, keyword: word })}
                              >
                                {word}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="mt-7 flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-opera/75 bg-opera/18 text-operaSoft transition hover:bg-opera/28"
                          onClick={() => playEpisode(episode)}
                          aria-label={playingThis ? 'Pause' : 'Play'}
                        >
                          {playingThis ? <Pause className="h-5 w-5" /> : <Play className="ml-0.5 h-5 w-5" />}
                        </button>

                        <button
                          type="button"
                          className="shrink-0 rounded-full border border-anthracite/75 px-3 py-2 text-xs uppercase tracking-[0.1em] text-mist/75 transition hover:border-opera/55 hover:text-operaSoft disabled:cursor-not-allowed disabled:opacity-40"
                          onClick={() => seekRelative(-10)}
                          disabled={!isActive}
                        >
                          -10s
                        </button>

                        <button
                          type="button"
                          className="shrink-0 rounded-full border border-anthracite/75 px-3 py-2 text-xs uppercase tracking-[0.1em] text-mist/75 transition hover:border-opera/55 hover:text-operaSoft disabled:cursor-not-allowed disabled:opacity-40"
                          onClick={() => seekRelative(10)}
                          disabled={!isActive}
                        >
                          +10s
                        </button>

                        <div className="order-last basis-full md:order-none md:flex-1">
                          <input
                            type="range"
                            min={0}
                            max={100}
                            step={0.1}
                            value={shownProgress}
                            className="audio-slider"
                            style={{ '--progress': `${shownProgress}%` }}
                            onChange={(event) => {
                              if (!isActive || !howlRef.current) {
                                return
                              }

                              const nextProgress = Number(event.target.value)
                              const total = howlRef.current.duration() || shownDuration
                              const nextSeek = seekFromProgress(nextProgress, total)
                              howlRef.current.seek(nextSeek)
                              const { percent } = calculatePlaybackProgress(nextSeek, total)
                              setProgress(percent)
                              setCurrentTime(nextSeek)
                              persistPlaybackPosition(episode.id, nextSeek, total)
                            }}
                          />
                        </div>

                        <p className="ml-auto w-auto shrink-0 text-right text-xs text-mist/80 md:w-24 md:text-sm">
                          {formatAudioTime(shownCurrent)} / {formatAudioTime(shownDuration)}
                        </p>

                        <label className="shrink-0 rounded-full border border-anthracite/75 px-2 py-1 text-xs text-mist/75">
                          <span className="mr-1">Vitesse</span>
                          <select
                            value={playbackRate}
                            onChange={(event) => setPlaybackRate(Number(event.target.value))}
                            className="bg-transparent text-xs text-mist focus:outline-none"
                          >
                            {PLAYBACK_RATE_OPTIONS.map((rate) => (
                              <option key={`rate-${rate}`} value={rate}>
                                {rate}x
                              </option>
                            ))}
                          </select>
                        </label>

                        <button
                          type="button"
                          className="inline-flex shrink-0 items-center gap-2 rounded-full border border-anthracite/70 px-3 py-2 text-xs uppercase tracking-[0.12em] text-operaSoft transition hover:border-opera/65 hover:bg-opera/10"
                          onClick={() => openQuoteModal(episode)}
                        >
                          <Quote className="h-3.5 w-3.5" />
                          Citer
                        </button>
                      </div>

                      <div className="mt-6 fade-divider" />

                      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => toggleFavorite(episode.id)}
                            className="inline-flex items-center gap-2 rounded-full border border-anthracite/80 px-3 py-2 text-xs uppercase tracking-[0.1em] text-mist/82 transition hover:border-opera/60 hover:text-operaSoft"
                          >
                            <Heart
                              className="h-4 w-4"
                              fill={favoriteSet.has(episode.id) ? '#B22222' : 'none'}
                            />
                            Favoris
                          </button>

                          <a
                            href={episode.audioUrl}
                            download
                            className="inline-flex items-center gap-2 rounded-full border border-anthracite/80 px-3 py-2 text-xs uppercase tracking-[0.1em] text-mist/82 transition hover:border-opera/60 hover:text-operaSoft"
                          >
                            <Download className="h-4 w-4" />
                            Download MP3
                          </a>

                          <button
                            type="button"
                            className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs uppercase tracking-[0.1em] transition ${
                              isOfflineReady
                                ? 'border-opera/60 bg-opera/10 text-operaSoft'
                                : 'border-anthracite/80 text-mist/82 hover:border-opera/60 hover:text-operaSoft'
                            }`}
                            onClick={() => toggleOfflineEpisode(episode)}
                            disabled={isOfflineBusy}
                          >
                            <Download className="h-4 w-4" />
                            {isOfflineBusy ? '...' : isOfflineReady ? 'Hors ligne OK' : 'Mode hors ligne'}
                          </button>
                        </div>

                        <a
                          className="inline-flex items-center gap-2 rounded-full border border-anthracite/80 px-3 py-2 text-xs uppercase tracking-[0.1em] text-mist/82 transition hover:border-opera/60 hover:text-operaSoft"
                          href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(
                            `${episode.title} - ${resolveEpisodeUrl(episode.slug)}`,
                          )}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <Share2 className="h-4 w-4" />
                          Partager
                        </a>
                      </div>
                    </MotionArticle>
                  )
                })}
              </div>

              <div ref={loadMoreRef} className="py-10 text-center">
                {loadingMore && <p className="text-xs uppercase tracking-[0.2em] text-mist/60">Chargement...</p>}
                {!hasMore && <p className="text-xs uppercase tracking-[0.2em] text-mist/50">Fin du flux</p>}
              </div>
            </MotionSection>
          )}
        </AnimatePresence>
      </main>

      {activeEpisode && (
        <div className="pointer-events-none fixed inset-x-0 bottom-3 z-50 px-3 md:px-6">
          <div className="pointer-events-auto mx-auto w-full max-w-[860px] rounded-2xl border border-anthracite/80 bg-bitume/92 p-3 shadow-[0_12px_32px_rgba(0,0,0,0.55)] backdrop-blur">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-opera/75 bg-opera/18 text-operaSoft transition hover:bg-opera/28"
                onClick={() => playEpisode(activeEpisode)}
                aria-label={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
              </button>

              <button
                type="button"
                className="rounded-full border border-anthracite/75 px-3 py-2 text-[11px] uppercase tracking-[0.1em] text-mist/75 transition hover:border-opera/55 hover:text-operaSoft"
                onClick={() => seekRelative(-10)}
              >
                -10s
              </button>

              <button
                type="button"
                className="rounded-full border border-anthracite/75 px-3 py-2 text-[11px] uppercase tracking-[0.1em] text-mist/75 transition hover:border-opera/55 hover:text-operaSoft"
                onClick={() => seekRelative(10)}
              >
                +10s
              </button>

              <div className="min-w-0 flex-1 px-1">
                <p className="truncate text-sm text-opera">{activeEpisode.title}</p>
                <p className="truncate text-[11px] uppercase tracking-[0.12em] text-mist/55">
                  {activeEpisode.category} | {activeEpisode.location.label}
                </p>
              </div>

              <label className="rounded-full border border-anthracite/75 px-2 py-1 text-[11px] text-mist/75">
                <span className="mr-1">Vitesse</span>
                <select
                  value={playbackRate}
                  onChange={(event) => setPlaybackRate(Number(event.target.value))}
                  className="bg-transparent text-[11px] text-mist focus:outline-none"
                >
                  {PLAYBACK_RATE_OPTIONS.map((rate) => (
                    <option key={`sticky-rate-${rate}`} value={rate}>
                      {rate}x
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input
                type="range"
                min={0}
                max={100}
                step={0.1}
                value={progress}
                className="audio-slider order-last basis-full sm:order-none sm:flex-1"
                style={{ '--progress': `${progress}%` }}
                onChange={(event) => {
                  if (!howlRef.current || !activeEpisode) {
                    return
                  }
                  const nextProgress = Number(event.target.value)
                  const total = howlRef.current.duration() || trackDuration || activeEpisode.duration
                  const nextSeek = seekFromProgress(nextProgress, total)
                  howlRef.current.seek(nextSeek)
                  const { percent } = calculatePlaybackProgress(nextSeek, total)
                  setProgress(percent)
                  setCurrentTime(nextSeek)
                  persistPlaybackPosition(activeEpisode.id, nextSeek, total)
                }}
              />
              <p className="ml-auto w-auto text-right text-xs text-mist/75 sm:w-24">
                {formatAudioTime(currentTime)} / {formatAudioTime(trackDuration || activeEpisode.duration)}
              </p>
            </div>
          </div>
        </div>
      )}

      <footer className="mx-auto mt-8 flex w-full max-w-[860px] flex-wrap items-center justify-center gap-4 border-t border-anthracite/80 px-4 py-6 text-sm md:gap-8 md:px-6">
        <a href="/mentions-legales.html" className="footer-link">
          Mentions Legales
        </a>
        <a href="/contact.html" className="footer-link">
          Contact
        </a>
        <button
          type="button"
          className="footer-link"
          onClick={() => {
            setSuggestionSent('')
            setSuggestModalOpen(true)
          }}
        >
          Proposer une tchatche
        </button>
      </footer>

      <AnimatePresence>
        {suggestModalOpen && (
          <MotionDiv
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeSuggestModal}
          >
            <MotionDiv
              initial={{ y: 22, opacity: 0, scale: 0.98 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 14, opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.24 }}
              className="episode-shell max-h-[86vh] w-full max-w-xl overflow-y-auto rounded-2xl p-5"
              onClick={(event) => event.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby={suggestDialogTitleId}
              ref={suggestDialogRef}
              tabIndex={-1}
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.15em] text-mist/55">Contribution</p>
                  <h3 id={suggestDialogTitleId} className="font-serif text-3xl text-opera">
                    Proposer une tchatche
                  </h3>
                </div>
                <button
                  type="button"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-anthracite/80 text-mist/80 transition hover:border-opera/50 hover:text-operaSoft"
                  onClick={closeSuggestModal}
                  ref={suggestInitialFocusRef}
                  aria-label="Fermer la fenêtre de proposition"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form className="space-y-3" onSubmit={submitSuggestion}>
                <input
                  type="text"
                  placeholder="Nom *"
                  value={suggestForm.name}
                  onChange={(event) => setSuggestForm((current) => ({ ...current, name: event.target.value }))}
                  className="w-full rounded-xl border border-anthracite/80 bg-black/20 px-3 py-2 text-sm text-mist placeholder:text-mist/45 focus:border-opera/60 focus:outline-none"
                  aria-label="Nom"
                />
                <input
                  type="email"
                  placeholder="Email (optionnel)"
                  value={suggestForm.email}
                  onChange={(event) => setSuggestForm((current) => ({ ...current, email: event.target.value }))}
                  className="w-full rounded-xl border border-anthracite/80 bg-black/20 px-3 py-2 text-sm text-mist placeholder:text-mist/45 focus:border-opera/60 focus:outline-none"
                  aria-label="Email"
                />
                <div className="grid gap-3 md:grid-cols-[1fr_1fr]">
                  <select
                    value={suggestForm.category}
                    onChange={(event) => setSuggestForm((current) => ({ ...current, category: event.target.value }))}
                    className="w-full rounded-xl border border-anthracite/80 bg-black/20 px-3 py-2 text-sm text-mist focus:border-opera/60 focus:outline-none"
                    aria-label="Categorie"
                  >
                    {NAV_ITEMS.map((item) => (
                      <option key={`suggest-cat-${item}`} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    placeholder="Lieu / quartier *"
                    value={suggestForm.location}
                    onChange={(event) => setSuggestForm((current) => ({ ...current, location: event.target.value }))}
                    className="w-full rounded-xl border border-anthracite/80 bg-black/20 px-3 py-2 text-sm text-mist placeholder:text-mist/45 focus:border-opera/60 focus:outline-none"
                    aria-label="Lieu ou quartier"
                  />
                </div>
                <textarea
                  rows={4}
                  placeholder="Pitch de la tchatche *"
                  value={suggestForm.pitch}
                  onChange={(event) => setSuggestForm((current) => ({ ...current, pitch: event.target.value }))}
                  className="w-full rounded-xl border border-anthracite/80 bg-black/20 px-3 py-2 text-sm text-mist placeholder:text-mist/45 focus:border-opera/60 focus:outline-none"
                  aria-label="Pitch de la tchatche"
                />
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs text-mist/60">* champs obligatoires</p>
                  <button
                    type="submit"
                    disabled={suggestSubmitting}
                    className="rounded-full border border-opera/60 px-4 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-operaSoft transition hover:bg-opera/10"
                  >
                    {suggestSubmitting ? 'Envoi...' : 'Envoyer'}
                  </button>
                </div>
                {suggestionSent && <p className="text-xs text-operaSoft">{suggestionSent}</p>}
              </form>
            </MotionDiv>
          </MotionDiv>
        )}

        {quoteModal.open && quoteModal.episode && (
          <MotionDiv
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeQuoteModal}
          >
            <MotionDiv
              initial={{ y: 22, opacity: 0, scale: 0.98 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 14, opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.24 }}
              className="episode-shell max-h-[86vh] w-full max-w-xl overflow-y-auto rounded-2xl p-5"
              onClick={(event) => event.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby={quoteDialogTitleId}
              ref={quoteDialogRef}
              tabIndex={-1}
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.15em] text-mist/55">Partage d extrait</p>
                  <h3 id={quoteDialogTitleId} className="font-serif text-3xl text-opera">
                    {quoteModal.episode.title}
                  </h3>
                </div>
                <button
                  type="button"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-anthracite/80 text-mist/80 transition hover:border-opera/50 hover:text-operaSoft"
                  onClick={closeQuoteModal}
                  ref={quoteInitialFocusRef}
                  aria-label="Fermer la fenêtre de partage"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-[0.12em] text-mist/60">
                    <span>Debut</span>
                    <span>{formatAudioTime(quoteStart)}</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={quoteMaxStart}
                    value={quoteStart}
                    className="quote-slider"
                    style={{ '--progress': `${quoteMaxStart ? (quoteStart / quoteMaxStart) * 100 : 0}%` }}
                    onChange={(event) => {
                      const nextStart = Number(event.target.value)
                      setQuoteStart(nextStart)
                      setQuoteLength((current) => {
                        const maxLen = Math.min(30, Math.max(15, quoteDurationBase - nextStart))
                        return Math.min(current, maxLen)
                      })
                    }}
                  />
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-[0.12em] text-mist/60">
                    <span>Duree</span>
                    <span>{quoteLength}s</span>
                  </div>
                  <input
                    type="range"
                    min={15}
                    max={quoteMaxLength}
                    value={quoteLength}
                    className="quote-slider"
                    style={{ '--progress': `${quoteMaxLength > 15 ? ((quoteLength - 15) / (quoteMaxLength - 15)) * 100 : 100}%` }}
                    onChange={(event) => setQuoteLength(Number(event.target.value))}
                  />
                </div>
              </div>

              <div className="mt-5 rounded-xl border border-anthracite/75 bg-black/25 p-3 text-sm text-mist/85">
                Segment: {formatAudioTime(quoteStart)} {'->'} {formatAudioTime(quoteEnd)}
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={copyQuote}
                  className="inline-flex items-center gap-2 rounded-full border border-opera/65 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-operaSoft transition hover:bg-opera/10"
                >
                  <Quote className="h-3.5 w-3.5" />
                  Copier le lien
                </button>
                <p className="text-xs text-mist/70">{quoteCopied ? 'Lien copie.' : quoteLink}</p>
              </div>
            </MotionDiv>
          </MotionDiv>
        )}
      </AnimatePresence>
    </div>
  )
}

export default App
