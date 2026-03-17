import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import App from './App'

describe('App - non-regression logique utilisateur', () => {
  test('affiche des durées formatées en m:ss', () => {
    render(<App />)

    expect(screen.getByText('0:00 / 3:45')).toBeInTheDocument()
    expect(screen.getByText('0:00 / 4:05')).toBeInTheDocument()
  })

  test('applique les filtres de recherche et filtres avancés', () => {
    render(<App />)

    const searchInput = screen.getByPlaceholderText('Rechercher')
    fireEvent.change(searchInput, { target: { value: 'vieux-port' } })
    expect(screen.getByRole('heading', { name: /jeanine : matin du vieux-port/i })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /marius : le roi du panier/i })).not.toBeInTheDocument()

    fireEvent.change(searchInput, { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Filtres' }))
    fireEvent.change(screen.getByLabelText('Duree'), { target: { value: 'long' } })
    fireEvent.change(screen.getByLabelText('Lieu'), { target: { value: 'Corbieres' } })
    fireEvent.change(screen.getByLabelText('Mot-cle'), { target: { value: 'accent' } })

    expect(screen.getByRole('heading', { name: /ines : crepuscule a corbieres/i })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Citer' })).toHaveLength(1)
  })

  test('genere un lien deep-link hash pour les citations', () => {
    render(<App />)

    const citeButtons = screen.getAllByRole('button', { name: 'Citer' })
    fireEvent.click(citeButtons[0])

    expect(screen.getByText(/#episode=marius-roi-panier-p1-1&t=0&d=20/)).toBeInTheDocument()
    expect(screen.getByText(/Segment: 0:00 -> 0:20/)).toBeInTheDocument()

    const startLabel = screen.getByText('Debut')
    const startSlider = startLabel.closest('div')?.parentElement?.querySelector('input[type="range"]')
    expect(startSlider).not.toBeNull()

    fireEvent.change(startSlider, { target: { value: '5' } })

    expect(screen.getByText(/#episode=marius-roi-panier-p1-1&t=5&d=20/)).toBeInTheDocument()
    expect(screen.getByText(/Segment: 0:05 -> 0:25/)).toBeInTheDocument()
  })
})
