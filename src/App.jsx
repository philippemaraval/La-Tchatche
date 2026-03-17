import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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

const NAV_ITEMS = ['Marchés', 'Cafés', 'Plages', 'Stade', 'Boutiques', 'Écoles']

const LEXICON = {
  accent: 'L accent marseillais est chantant, solaire et tres identitaire.',
  minot: 'Un minot est un enfant du quartier, souvent plein de malice.',
  gabian: 'Gabian designe la mouette locale, omnipresente autour du port.',
  degun: 'Degun signifie personne. Exemple: "Y a degun sur la place."',
  fada: 'Fada veut dire un peu fou, souvent avec affection.',
  pitchoun: 'Pitchoun decrit un petit enfant, terme affectif du Sud.',
  emboucaner: 'Emboucaner, c est se meler d une affaire et creer du remous.',
}

const BASE_EPISODES = [
  {
    id: 'ep-001',
    slug: 'marius-roi-panier',
    title: 'Marius : Le Roi du Panier',
    category: 'Stade',
    location: { label: 'Le Panier', lat: 43.3002, lng: 5.3698 },
    duration: 225,
    keywords: ['accent', 'degun', 'fada'],
    summary:
      'Il parle de petanque comme d une religion, entre rire gras et tacle glisse. Un [[accent]] qui sent le soleil et les gradins ou il n y a [[degun]] quand l OM est en deplacement.',
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
  },
  {
    id: 'ep-002',
    slug: 'samia-cours-julien-neons',
    title: 'Samia : Neons du Cours Julien',
    category: 'Boutiques',
    location: { label: 'Cours Julien', lat: 43.2933, lng: 5.3836 },
    duration: 248,
    keywords: ['minot', 'fada', 'emboucaner'],
    summary:
      'Dans les rues qui vibrent jusqu a tard, chaque facade raconte un couplet. Les [[minot]] dansent et les anciens disent que c est un peu [[fada]], mais la ville aime cette energie.',
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
  },
  {
    id: 'ep-003',
    slug: 'jeanine-vieux-port-matin',
    title: 'Jeanine : Matin du Vieux-Port',
    category: 'Cafés',
    location: { label: 'Vieux-Port', lat: 43.2951, lng: 5.3743 },
    duration: 201,
    keywords: ['gabian', 'accent'],
    summary:
      'Avant la foule, il y a les bateaux, le cafe et les [[gabian]] qui tournent. Sa voix tire des images nettes, presque en noir et rouge, avec un [[accent]] de cinema.',
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
  },
  {
    id: 'ep-004',
    slug: 'amelie-plage-soir',
    title: 'Amelie : L Ecume de Prado',
    category: 'Plages',
    location: { label: 'Plages du Prado', lat: 43.2694, lng: 5.3756 },
    duration: 232,
    keywords: ['pitchoun', 'gabian'],
    summary:
      'Le vent ramene les histoires de famille sur le sable. On entend les [[pitchoun]] courir, les [[gabian]] crier, et la ville prendre une respiration plus lente.',
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3',
  },
  {
    id: 'ep-005',
    slug: 'nadir-noailles-marche',
    title: 'Nadir : Le Marche qui Deborde',
    category: 'Marchés',
    location: { label: 'Noailles', lat: 43.2968, lng: 5.3796 },
    duration: 239,
    keywords: ['emboucaner', 'degun'],
    summary:
      'A Noailles, tout est negocie, improvise, partage. Quand quelqu un veut [[emboucaner]] la discussion, Nadir replace le cadre: ici, on ecoute avant de juger.',
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3',
  },
  {
    id: 'ep-006',
    slug: 'leila-stade-bouillant',
    title: 'Leila : Virage en Feu',
    category: 'Stade',
    location: { label: 'Orange Velodrome', lat: 43.2699, lng: 5.3959 },
    duration: 216,
    keywords: ['fada', 'accent'],
    summary:
      'Elle raconte la tribune comme une chorale brute. C est [[fada]], massif, tendre aussi. Le chant monte, l [[accent]] coupe l air, et tout le quartier tient debout.',
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3',
  },
  {
    id: 'ep-007',
    slug: 'paolo-port-ferrys',
    title: 'Paolo : Ferrys et Brouillard',
    category: 'Cafés',
    location: { label: 'Quai du Port', lat: 43.2969, lng: 5.3718 },
    duration: 255,
    keywords: ['gabian', 'degun'],
    summary:
      'Entre les annonces de depart et l odeur de metal, Paolo garde un calme rare. Il dit qu a 6h, il n y a presque [[degun]], juste les [[gabian]] et le bruit sourd des coques.',
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3',
  },
  {
    id: 'ep-008',
    slug: 'ines-plage-crepuscule',
    title: 'Ines : Crepuscule a Corbieres',
    category: 'Écoles',
    location: { label: 'Corbieres', lat: 43.3282, lng: 5.2921 },
    duration: 244,
    keywords: ['pitchoun', 'accent'],
    summary:
      'Le soleil tombe derriere les rochers, et la parole devient lente, precise. Ines parle de ses [[pitchoun]] et de cet [[accent]] qui reste meme loin de Marseille.',
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3',
  },
]

const MAX_BATCHES = 14
const FAVORITES_KEY = 'la-tchatche-favoris'
const MotionSection = motion.section
const MotionArticle = motion.article
const MotionDiv = motion.div
const MotionSpan = motion.span
const MARSEILLE_CENTER = [43.2965, 5.3698]

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

function formatTime(value) {
  const total = Math.max(0, Math.floor(value || 0))
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
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

function buildEpisodeBatch(page, count = 4) {
  const items = []
  for (let index = 0; index < count; index += 1) {
    const base = BASE_EPISODES[(page * count + index) % BASE_EPISODES.length]
    items.push({
      ...base,
      id: `${base.id}-p${page + 1}-${index + 1}`,
      slug: `${base.slug}-p${page + 1}-${index + 1}`,
      title: page === 0 ? base.title : `${base.title} (Session ${page + 1})`,
      duration: base.duration + ((page + index) % 3) * 6,
      location: {
        ...base.location,
        lat: base.location.lat + ((index % 2 === 0 ? 1 : -1) * 0.0018 * page) / 10,
        lng: base.location.lng + ((index % 3 === 0 ? -1 : 1) * 0.0016 * page) / 10,
      },
    })
  }
  return items
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
  const [query, setQuery] = useState('')
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)

  const [favorites, setFavorites] = useState(() => {
    const raw = localStorage.getItem(FAVORITES_KEY)
    if (!raw) {
      return []
    }

    try {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
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

  const loadMoreRef = useRef(null)
  const pageRef = useRef(1)
  const progressTimerRef = useRef(null)
  const timeoutRef = useRef(null)
  const transitionTokenRef = useRef(0)
  const howlRef = useRef(null)
  const audioContextRef = useRef(null)
  const bridgeStopRef = useRef(null)

  useEffect(() => {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites))
  }, [favorites])

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

  const stopProgressTicker = () => {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current)
      progressTimerRef.current = null
    }
  }

  const startProgressTicker = (howl, fallbackDuration) => {
    stopProgressTicker()
    progressTimerRef.current = setInterval(() => {
      if (!howl.playing()) {
        return
      }

      const seek = typeof howl.seek() === 'number' ? howl.seek() : 0
      const duration = howl.duration() || fallbackDuration || 0

      setCurrentTime(seek)
      setTrackDuration(duration)
      setProgress(duration > 0 ? Math.min(100, (seek / duration) * 100) : 0)
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

  const filteredEpisodes = useMemo(() => {
    const search = query.trim().toLowerCase()

    return episodes.filter((episode) => {
      if (selectedNav && episode.category !== selectedNav) {
        return false
      }

      if (!search) {
        return true
      }

      const haystack = `${episode.title} ${episode.summary} ${episode.category} ${episode.location.label}`.toLowerCase()
      return haystack.includes(search)
    })
  }, [episodes, query, selectedNav])

  const nearestEpisodes = useMemo(() => {
    if (!userPosition) {
      return []
    }

    return filteredEpisodes
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
  }, [filteredEpisodes, userPosition])

  const nearestEpisodeIds = useMemo(() => new Set(nearestEpisodes.map((episode) => episode.id)), [nearestEpisodes])
  const isNearestModeActive = mapMode === 'nearest' && Boolean(userPosition)

  const mapEpisodes = useMemo(() => {
    if (isNearestModeActive) {
      return nearestEpisodes
    }
    return filteredEpisodes
  }, [filteredEpisodes, isNearestModeActive, nearestEpisodes])

  const mapPoints = useMemo(
    () =>
      mapEpisodes.map((episode) => ({
        id: episode.id,
        title: episode.title,
        category: episode.category,
        locationLabel: episode.location.label,
        lat: episode.location.lat,
        lng: episode.location.lng,
        active: nearestEpisodeIds.has(episode.id),
        episode,
      })),
    [mapEpisodes, nearestEpisodeIds],
  )

  const selectedMapEpisode = useMemo(
    () => mapEpisodes.find((episode) => episode.id === selectedMapEpisodeId) || null,
    [mapEpisodes, selectedMapEpisodeId],
  )

  const playEpisode = async (episode) => {
    setAudioError('')
    const current = howlRef.current

    if (activeEpisodeId === episode.id && current) {
      if (current.playing()) {
        current.pause()
        setIsPlaying(false)
        stopProgressTicker()
      } else {
        current.play()
        setIsPlaying(true)
        startProgressTicker(current, episode.duration)
      }
      return
    }

    transitionTokenRef.current += 1
    const token = transitionTokenRef.current

    if (bridgeStopRef.current) {
      bridgeStopRef.current()
    }

    if (current) {
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

    const next = new Howl({
      src: [episode.audioUrl],
      html5: true,
      volume: 0.95,
      onload: () => {
        setTrackDuration(next.duration() || episode.duration)
      },
      onplay: () => {
        setIsPlaying(true)
        startProgressTicker(next, episode.duration)
      },
      onpause: () => {
        setIsPlaying(false)
      },
      onstop: () => {
        setIsPlaying(false)
      },
      onend: () => {
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

  const openQuoteModal = (episode) => {
    setQuoteModal({ open: true, episode })
    const start = activeEpisodeId === episode.id ? Math.floor(currentTime) : 0
    setQuoteStart(start)
    setQuoteLength(20)
    setQuoteCopied(false)
  }

  const closeQuoteModal = () => {
    setQuoteModal({ open: false, episode: null })
    setQuoteCopied(false)
  }

  const quoteDurationBase = quoteModal.episode ? quoteModal.episode.duration : 30
  const quoteMaxStart = Math.max(0, quoteDurationBase - 15)
  const quoteMaxLength = Math.min(30, Math.max(15, quoteDurationBase - quoteStart))
  const quoteEnd = Math.min(quoteDurationBase, quoteStart + quoteLength)

  const quoteLink = useMemo(() => {
    if (!quoteModal.episode) {
      return ''
    }

    const origin = window.location.origin
    return `${origin}/#episode=${quoteModal.episode.slug}&t=${Math.floor(quoteStart)}&d=${Math.floor(quoteLength)}`
  }, [quoteLength, quoteModal.episode, quoteStart])

  const copyQuote = async () => {
    if (!quoteModal.episode) {
      return
    }

    const payload = `${quoteModal.episode.title} [${formatTime(quoteStart)} - ${formatTime(quoteEnd)}] ${quoteLink}`

    try {
      await navigator.clipboard.writeText(payload)
      setQuoteCopied(true)
    } catch {
      setQuoteCopied(false)
    }
  }

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
    <div className="bitume-noise min-h-screen pb-20 text-mist">
      <header className="frosted-header sticky top-0 z-40 border-b border-anthracite/90 bg-bitume/88">
        <div className="mx-auto grid w-full max-w-[1360px] gap-4 px-4 py-3 md:grid-cols-[1fr_auto_1fr] md:items-center md:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <img
              src={laTchatcheLogo}
              alt="Logo La Tchatche"
              className="h-14 w-auto rounded-sm object-contain shadow-[0_12px_28px_rgba(0,0,0,0.5)] md:h-16"
            />
          </div>

          <div className="mobile-scroll flex items-center gap-2 rounded-full border border-anthracite/80 bg-asphalt/60 px-3 py-2 shadow-glass md:justify-self-center">
            <button
              type="button"
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold tracking-[0.12em] transition ${
                viewMode === 'map'
                  ? 'border-opera/80 bg-opera/20 text-operaSoft'
                  : 'border-anthracite bg-transparent text-mist/80 hover:border-opera/55 hover:text-operaSoft'
              }`}
              onClick={() => {
                setViewMode((current) => (current === 'map' ? 'feed' : 'map'))
                if (!userPosition && geoStatus === 'idle') {
                  requestGeo()
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
                    setSelectedNav((current) => (current === item ? null : item))
                  }}
                >
                  {item}
                </button>
                {index < NAV_ITEMS.length - 1 && <span className="px-1 text-anthracite">|</span>}
              </div>
            ))}
          </div>

          <label className="flex items-center gap-2 rounded-full border border-anthracite/80 bg-black/25 px-3 py-2 shadow-glass md:justify-self-end">
            <Search className="h-4 w-4 text-mist/65" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="w-full bg-transparent text-sm text-mist placeholder:text-mist/45 focus:outline-none md:w-52"
              placeholder="Rechercher"
              type="search"
            />
          </label>
        </div>
      </header>

      <main className="mx-auto mt-8 w-full max-w-[860px] px-4 md:px-6">
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
                    {mapMode === 'nearest' ? '5 tchatches les plus proches' : 'Toutes les tchatches disponibles'}
                  </h2>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <div className="inline-flex rounded-full border border-anthracite/70 bg-black/35 p-1">
                    <button
                      type="button"
                      className={`rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] transition ${
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
                      className={`rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] transition ${
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
                      5 proches
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

              <div className="map-grid map-surface relative mt-5 overflow-hidden rounded-2xl border border-anthracite/80 p-1">
                <MapContainer center={MARSEILLE_CENTER} zoom={12} scrollWheelZoom className="h-72 w-full rounded-xl">
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                    url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                  />
                  <FitMapBounds points={mapPoints} userPosition={userPosition} />

                  {mapPoints.map((point) => (
                    <CircleMarker
                      key={point.id}
                      center={[point.lat, point.lng]}
                      radius={point.active ? 8 : 6}
                      pathOptions={{
                        color: point.active ? '#b22222' : '#d7d7d7',
                        fillColor: point.active ? '#b22222' : '#7b7b7b',
                        fillOpacity: point.active ? 0.9 : 0.7,
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
                    La vue 5 proches est optionnelle. Sans position valide, toutes les tchatches restent affichées.
                  </p>
                )}
                {mapEpisodes.length === 0 && (
                  <p className="text-sm text-mist/70">Aucun episode ne correspond a ce filtre.</p>
                )}

                {mapEpisodes.map((episode) => (
                  <div
                    key={`map-${episode.id}`}
                    className="flex items-center justify-between rounded-xl border border-anthracite/70 bg-black/20 px-4 py-3"
                  >
                    <div>
                      <p className="font-serif text-xl text-opera">{episode.title}</p>
                      <p className="text-xs uppercase tracking-[0.15em] text-mist/55">
                        {episode.category} | {episode.location.label}
                      </p>
                    </div>
                    {mapMode === 'nearest' && userPosition && typeof episode.distance === 'number' ? (
                      <span className="inline-flex items-center gap-2 rounded-full border border-opera/40 px-3 py-1 text-xs text-operaSoft">
                        <Compass className="h-3.5 w-3.5" />
                        {episode.distance.toFixed(2)} km
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-2 rounded-full border border-mist/30 px-3 py-1 text-xs text-mist/75">
                        <MapPinned className="h-3.5 w-3.5" />
                        Disponible
                      </span>
                    )}
                  </div>
                ))}
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
                  const qrValue = `${window.location.origin}/#episode=${episode.slug}`

                  return (
                    <MotionArticle
                      key={episode.id}
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
                        </div>

                        <div className="hidden items-end gap-2 md:flex md:flex-col">
                          <QRCodeSVG
                            value={qrValue}
                            size={60}
                            bgColor="transparent"
                            fgColor="#B22222"
                            level="Q"
                          />
                          <span className="text-[0.62rem] uppercase tracking-[0.18em] text-mist/45">QR</span>
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

                      <div className="mt-7 flex items-center gap-3">
                        <button
                          type="button"
                          className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-opera/75 bg-opera/18 text-operaSoft transition hover:bg-opera/28"
                          onClick={() => playEpisode(episode)}
                          aria-label={playingThis ? 'Pause' : 'Play'}
                        >
                          {playingThis ? <Pause className="h-5 w-5" /> : <Play className="ml-0.5 h-5 w-5" />}
                        </button>

                        <div className="flex-1">
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
                              const nextSeek = (nextProgress / 100) * total
                              howlRef.current.seek(nextSeek)
                              setProgress(nextProgress)
                              setCurrentTime(nextSeek)
                            }}
                          />
                        </div>

                        <p className="w-24 text-right text-sm text-mist/80">
                          {formatTime(shownCurrent)} / {formatTime(shownDuration)}
                        </p>

                        <button
                          type="button"
                          className="inline-flex items-center gap-2 rounded-full border border-anthracite/70 px-3 py-2 text-xs uppercase tracking-[0.12em] text-operaSoft transition hover:border-opera/65 hover:bg-opera/10"
                          onClick={() => openQuoteModal(episode)}
                        >
                          <Quote className="h-3.5 w-3.5" />
                          Citer
                        </button>
                      </div>

                      <div className="mt-6 fade-divider" />

                      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
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
                        </div>

                        <a
                          className="inline-flex items-center gap-2 rounded-full border border-anthracite/80 px-3 py-2 text-xs uppercase tracking-[0.1em] text-mist/82 transition hover:border-opera/60 hover:text-operaSoft"
                          href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(
                            `${episode.title} - ${window.location.origin}/#episode=${episode.slug}`,
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

      <footer className="mx-auto mt-8 flex w-full max-w-[860px] items-center justify-center gap-8 border-t border-anthracite/80 px-4 py-6 text-sm md:px-6">
        <a href="#" className="footer-link">
          Mentions Legales
        </a>
        <a href="#" className="footer-link">
          Contact
        </a>
      </footer>

      <AnimatePresence>
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
              className="episode-shell w-full max-w-xl rounded-2xl p-5"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.15em] text-mist/55">Partage d extrait</p>
                  <h3 className="font-serif text-3xl text-opera">{quoteModal.episode.title}</h3>
                </div>
                <button
                  type="button"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-anthracite/80 text-mist/80 transition hover:border-opera/50 hover:text-operaSoft"
                  onClick={closeQuoteModal}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-[0.12em] text-mist/60">
                    <span>Debut</span>
                    <span>{formatTime(quoteStart)}</span>
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
                Segment: {formatTime(quoteStart)} {'->'} {formatTime(quoteEnd)}
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
