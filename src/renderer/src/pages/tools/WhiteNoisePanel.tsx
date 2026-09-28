import { useEffect, useRef, useState } from 'react'
import { Alert, Button, Chip, Stack, Slider, Typography } from '@mui/material'
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded'
import StopRoundedIcon from '@mui/icons-material/StopRounded'
import { Section } from '../../components/Section'

type NoiseKind = 'white' | 'pink' | 'brown' | 'rain' | 'ocean'

const PRESETS: Record<NoiseKind, { label: string; type: BiquadFilterType; frequency: number; q: number; lfo: number }> = {
  white: { label: '白噪音', type: 'lowpass', frequency: 18000, q: 0.7, lfo: 0 },
  pink: { label: '粉噪音', type: 'lowpass', frequency: 1400, q: 0.6, lfo: 0 },
  brown: { label: '棕噪音', type: 'lowpass', frequency: 420, q: 0.7, lfo: 0 },
  rain: { label: '雨声', type: 'bandpass', frequency: 1800, q: 0.4, lfo: 0 },
  ocean: { label: '海浪', type: 'lowpass', frequency: 620, q: 0.6, lfo: 0.08 }
}

export function WhiteNoisePanel() {
  const [kind, setKind] = useState<NoiseKind>('rain')
  const [volume, setVolume] = useState(35)
  const [playing, setPlaying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const ctxRef = useRef<AudioContext | null>(null)
  const sourceRef = useRef<AudioBufferSourceNode | null>(null)
  const gainRef = useRef<GainNode | null>(null)
  const lfoRef = useRef<OscillatorNode | null>(null)

  const stop = (): void => {
    sourceRef.current?.stop()
    sourceRef.current?.disconnect()
    lfoRef.current?.stop()
    lfoRef.current?.disconnect()
    sourceRef.current = null
    lfoRef.current = null
    setPlaying(false)
  }

  useEffect(() => () => stop(), [])

  useEffect(() => {
    if (gainRef.current && ctxRef.current) {
      gainRef.current.gain.setTargetAtTime((volume / 100) * 0.6, ctxRef.current.currentTime, 0.05)
    }
  }, [volume])

  const start = (): void => {
    try {
      stop()
      const ctx = ctxRef.current ?? new AudioContext()
      ctxRef.current = ctx
      void ctx.resume()

      const seconds = 4
      const buffer = ctx.createBuffer(2, ctx.sampleRate * seconds, ctx.sampleRate)
      for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
        const data = buffer.getChannelData(channel)
        let last = 0
        for (let i = 0; i < data.length; i += 1) {
          const white = Math.random() * 2 - 1
          if (kind === 'brown') {
            last = (last + 0.02 * white) / 1.02
            data[i] = last * 3.5
          } else if (kind === 'pink') {
            last = 0.98 * last + 0.02 * white
            data[i] = (last * 3 + white * 0.3) * 0.7
          } else {
            data[i] = white
          }
        }
      }

      const preset = PRESETS[kind]
      const source = ctx.createBufferSource()
      source.buffer = buffer
      source.loop = true

      const filter = ctx.createBiquadFilter()
      filter.type = preset.type
      filter.frequency.value = preset.frequency
      filter.Q.value = preset.q

      const gain = ctx.createGain()
      gain.gain.value = (volume / 100) * 0.6

      source.connect(filter).connect(gain).connect(ctx.destination)
      source.start()
      sourceRef.current = source
      gainRef.current = gain

      if (preset.lfo > 0) {
        const lfo = ctx.createOscillator()
        const lfoGain = ctx.createGain()
        lfo.frequency.value = preset.lfo
        lfoGain.gain.value = gain.gain.value * 0.6
        lfo.connect(lfoGain).connect(gain.gain)
        lfo.start()
        lfoRef.current = lfo
      }

      setPlaying(true)
      setError(null)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <Section title="白噪音 / 助眠音" subtitle="纯 Web Audio 实时合成，无需下载音频资源">
      <Stack spacing={2.5} sx={{ p: 1 }}>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {(Object.keys(PRESETS) as NoiseKind[]).map((key) => (
            <Chip
              key={key}
              label={PRESETS[key].label}
              color={kind === key ? 'primary' : 'default'}
              variant={kind === key ? 'filled' : 'outlined'}
              onClick={() => {
                setKind(key)
                if (playing) setTimeout(start, 50)
              }}
            />
          ))}
        </Stack>

        <Stack direction="row" spacing={2} alignItems="center">
          <Button
            variant="contained"
            startIcon={playing ? <StopRoundedIcon /> : <PlayArrowRoundedIcon />}
            onClick={() => (playing ? stop() : start())}
          >
            {playing ? '停止' : '播放'}
          </Button>
          <Typography variant="body2" color="text.secondary" sx={{ minWidth: 60 }}>
            音量 {volume}%
          </Typography>
          <Slider value={volume} onChange={(_event, value) => setVolume(value as number)} sx={{ maxWidth: 260 }} />
        </Stack>

        {error ? <Alert severity="error">{error}</Alert> : null}
        <Alert severity="info" icon={false}>
          长时间学习建议音量不超过 40%，并配合番茄钟使用。
        </Alert>
      </Stack>
    </Section>
  )
}
