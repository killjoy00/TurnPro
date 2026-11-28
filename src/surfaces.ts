import { RINK } from './hockey.ts'
import { COURT } from './basketball.ts'
import { PITCH } from './soccer.ts'
import { FIELD, fieldLines, type Match as FootballMatch } from './football.ts'

function floor(context: CanvasRenderingContext2D, width: number, height: number, colors: [string, string, string]) {
  const wash = context.createLinearGradient(0, 0, width, height)
  wash.addColorStop(0, colors[0])
  wash.addColorStop(.5, colors[1])
  wash.addColorStop(1, colors[2])
  context.fillStyle = wash
  context.fillRect(0, 0, width, height)
}

function net(context: CanvasRenderingContext2D, x: number, y: number, depth: number, height: number) {
  context.save()
  context.strokeRect(x, y, depth, height)
  context.lineWidth *= .48
  context.beginPath()
  for (let offset = 1; offset < height; offset++) {
    context.moveTo(x, y + offset)
    context.lineTo(x + depth, y + offset)
  }
  context.moveTo(x + depth * .5, y)
  context.lineTo(x + depth * .5, y + height)
  context.stroke()
  context.restore()
}

export function drawBasketball(context: CanvasRenderingContext2D) {
  floor(context, COURT.width, COURT.length, ['#f4c277', '#e5a65f', '#b7763d'])
  for (let row = 0; row < 45; row++) {
    const y = row * 1.05
    context.fillStyle = ['#74431b14', '#fff3c320', '#ab673518', '#ffeeaa17'][row % 4]
    context.fillRect(0, y, COURT.width, 1.05)
    context.fillStyle = '#60391625'
    for (let x = row * 3.35 % 12; x < COURT.width; x += 12) context.fillRect(x, y, .1, 1.05)
    context.fillRect(0, y, COURT.width, .04)
  }
  context.fillStyle = '#213b3d'
  context.fillRect(0, 0, COURT.width, 1.45)
  context.fillRect(0, 0, .9, COURT.length)
  context.fillRect(COURT.width - .9, 0, .9, COURT.length)

  const hoop = COURT.hoop
  context.lineWidth = 0.19
  context.strokeStyle = '#294745'
  context.strokeRect(1, 1.55, COURT.width - 2, COURT.length - 1.8)
  context.fillStyle = '#217d726a'
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
  context.strokeStyle = '#fff1cb'
  context.lineWidth = 0.26
  context.strokeRect(23, 2.7, 4, 1.3)
  context.strokeStyle = '#9f3527'
  context.lineWidth = 0.3
  context.beginPath()
  context.arc(hoop.x, hoop.y, 0.85, 0, Math.PI * 2)
  context.stroke()
}

export function drawSoccer(context: CanvasRenderingContext2D) {
  const { width, length } = PITCH
  const mid = length / 2
  floor(context, width, length, ['#1e6c45', '#287954', '#174a39'])
  for (let x = 0; x < width; x += 7) {
    context.fillStyle = x % 14 === 0 ? '#cbf29818' : '#09291813'
    context.fillRect(x, 0, 7, length)
  }

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
  context.fillStyle = '#e7f1dc'
  context.fillRect(width / 2 - .36, mid - .36, .72, .72)
  for (const edge of [0.25, width - 0.25]) {
    const into = edge < 1 ? 1 : -1
    context.strokeRect(edge, mid - 20.16, into * 16.5, 40.32)
    context.strokeRect(edge, mid - 9.16, into * 5.5, 18.32)
    context.fillStyle = '#e7f1dc'
    context.fillRect(edge + into * 10.75, mid - 0.32, 0.64, 0.64)
    net(context, edge, mid - 3.66, into * 2.8, 7.32)
  }
}

export function drawHockey(context: CanvasRenderingContext2D) {
  const { width, height } = RINK
  const mid = height / 2
  floor(context, width, height, ['#e0f4ff', '#f4fbff', '#8eb5d1'])
  context.strokeStyle = '#315d861d'
  context.lineWidth = .13
  context.beginPath()
  for (let index = 0; index < 96; index++) {
    const x = 4 + (index * 37.41) % (width - 15)
    const y = 3 + (index * 18.39) % (height - 6)
    context.moveTo(x, y)
    context.quadraticCurveTo(x + 2, y - .45, x + 5.3, y + .08)
  }
  context.stroke()
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
    net(context, x, mid - 3, x === 5 ? -1.8 : 1.8, 6)
    context.fillStyle = '#4799c55e'
    context.beginPath()
    context.arc(x, mid, 4.1, -Math.PI / 2, Math.PI / 2, x !== 5)
    context.fill()
  }
  function circle(x: number, y: number, radius: number, color: string) {
    context.strokeStyle = color
    context.lineWidth = 0.27
    context.beginPath()
    context.arc(x, y, radius, 0, Math.PI * 2)
    context.stroke()
  }
}

export function drawFootball(context: CanvasRenderingContext2D, match: FootballMatch) {
  const { width, height, goal } = FIELD
  floor(context, width, height, ['#244f48', '#287456', '#1a493b'])
  for (const [x, color] of [[0, '#14556a'], [width - goal, '#764b38']] as const) {
    context.save()
    context.fillStyle = color
    context.fillRect(x, 0, goal, height)
    context.beginPath()
    context.rect(x, 0, goal, height)
    context.clip()
    context.strokeStyle = '#ffffff20'
    context.lineWidth = .6
    for (let lane = -goal; lane < height; lane += 6) {
      context.beginPath()
      context.moveTo(x, lane)
      context.lineTo(x + goal, lane + goal)
      context.stroke()
    }
    context.restore()
  }
  context.strokeStyle = '#dfead7'
  context.lineWidth = 0.3
  context.strokeRect(0.4, 0.4, width - 0.8, height - 0.8)
  for (let x = goal; x <= width - goal; x += 5) {
    if (x % 20 === 10 && x < width - goal) {
      context.fillStyle = '#ffffff0b'
      context.fillRect(x, 0, 10, height)
    }
    if (x % 10 === 0) {
      context.beginPath()
      for (const lane of [21, 33]) {
        context.moveTo(x, lane - 0.55)
        context.lineTo(x, lane + 0.55)
      }
      context.stroke()
    } else {
      context.beginPath()
      context.moveTo(x, 0)
      context.lineTo(x, height)
      context.stroke()
    }
  }
  context.save()
  context.fillStyle = '#e6f6dfaa'
  context.font = 'bold 2.8px system-ui'
  context.textAlign = 'center'
  for (let x = 20; x < width - goal; x += 10) {
    const label = Math.min(x - goal, width - goal - x)
    context.fillText(String(label), x, 7)
    context.fillText(String(label), x, height - 4)
  }
  context.restore()
  const lines = fieldLines(match)
  context.lineWidth = 0.7
  for (const [x, color] of [[lines.scrimmage, '#a6dfff'], [lines.firstDown, '#f8d87c']] as const) {
    context.beginPath()
    context.strokeStyle = color
    context.moveTo(x, 0)
    context.lineTo(x, height)
    context.stroke()
  }
}
