import { RINK } from './hockey.ts'
import { COURT } from './basketball.ts'
import { PITCH } from './soccer.ts'

export function drawBasketball(context: CanvasRenderingContext2D) {
  context.fillStyle = '#d8bb88'
  context.fillRect(0, 0, COURT.width, COURT.length)
  for (let y = 0; y < COURT.length; y += 1.1) {
    context.fillStyle = Math.round(y / 1.1) % 2 ? '#ae885512' : '#fff2cc17'
    context.fillRect(0, y, COURT.width, 1.1)
  }

  const hoop = COURT.hoop
  context.lineWidth = 0.19
  context.strokeStyle = '#345652'
  context.strokeRect(0.25, 0.25, COURT.width - 0.5, COURT.length - 0.5)
  context.fillStyle = '#145f5650'
  context.fillRect(17, 0, 16, 19)
  context.strokeRect(17, 0, 16, 19)
  context.beginPath()
  context.arc(25, 19, 6, 0, Math.PI)
  context.stroke()
  context.beginPath()
  context.setLineDash([0.8, 0.5])
  context.arc(25, 19, 6, Math.PI, Math.PI * 2)
  context.stroke()
  context.setLineDash([])
  context.beginPath()
  context.arc(hoop.x, hoop.y, COURT.arc, Math.asin(-hoop.y / COURT.arc), Math.PI - Math.asin(-hoop.y / COURT.arc))
  context.stroke()
  context.beginPath()
  context.arc(25, 47, 6, Math.PI, Math.PI * 2)
  context.stroke()
  context.beginPath()
  context.moveTo(22, 4)
  context.lineTo(28, 4)
  context.stroke()
  context.strokeStyle = '#8b412c'
  context.lineWidth = 0.24
  context.beginPath()
  context.arc(hoop.x, hoop.y, 0.85, 0, Math.PI * 2)
  context.stroke()
}

export function drawSoccer(context: CanvasRenderingContext2D) {
  const { width, length } = PITCH
  const mid = length / 2
  context.fillStyle = '#2a624c'
  context.fillRect(0, 0, width, length)
  context.fillStyle = '#ffffff0b'
  for (let x = 0; x < width; x += 14) context.fillRect(x, 0, 7, length)

  context.strokeStyle = '#e7f1dc'
  context.lineWidth = 0.24
  context.strokeRect(0.25, 0.25, width - 0.5, length - 0.5)
  context.beginPath()
  context.moveTo(width / 2, 0)
  context.lineTo(width / 2, length)
  context.stroke()
  context.beginPath()
  context.arc(width / 2, mid, 9.15, 0, Math.PI * 2)
  context.stroke()
  for (const edge of [0.25, width - 0.25]) {
    const into = edge < 1 ? 1 : -1
    context.strokeRect(edge, mid - 20.16, into * 16.5, 40.32)
    context.strokeRect(edge, mid - 9.16, into * 5.5, 18.32)
    context.fillStyle = '#e7f1dc'
    context.fillRect(edge + into * 10.75, mid - 0.32, 0.64, 0.64)
    context.strokeRect(edge, mid - 3.66, into * 1.9, 7.32)
  }
}

export function drawHockey(context: CanvasRenderingContext2D) {
  const { width, height } = RINK
  const mid = height / 2
  context.fillStyle = '#dceaf1'
  context.fillRect(0, 0, width, height)
  context.strokeStyle = '#4b6c7c'
  context.lineWidth = 0.38
  context.beginPath()
  context.roundRect(0.35, 0.35, width - 0.7, height - 0.7, 4.5)
  context.stroke()
  for (const x of [33, 50, 67, 5, 95]) {
    context.strokeStyle = x === 33 || x === 67 ? '#226ea5' : '#a63840'
    context.lineWidth = x === 5 || x === 95 ? 0.25 : 0.55
    context.beginPath()
    context.moveTo(x, 0.4)
    context.lineTo(x, height - 0.4)
    context.stroke()
  }
  for (const x of [20, 80]) {
    for (const y of [12, 36]) circle(x, y, 5, '#b95456')
  }
  circle(width / 2, mid, 5, '#226ea5')
  for (const x of [5, 95]) {
    context.strokeStyle = '#9a2d38'
    context.strokeRect(x === 5 ? x - 1.8 : x, mid - 3, 1.8, 6)
    context.fillStyle = '#93c6df65'
    context.fillRect(x === 5 ? x : x - 3.6, mid - 3.6, 3.6, 7.2)
  }
  function circle(x: number, y: number, radius: number, color: string) {
    context.strokeStyle = color
    context.lineWidth = 0.27
    context.beginPath()
    context.arc(x, y, radius, 0, Math.PI * 2)
    context.stroke()
  }
}
