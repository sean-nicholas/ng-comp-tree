import * as glob from 'glob'
import { readFile } from 'fs'
import * as _ from 'lodash'
import { paramCase, pascalCase } from 'change-case'

const tree = []

const src = process.cwd()
const componentsSrc = `${src}/app/components`

function readFilePromise(file) {
  return new Promise((res, rej) => {
    readFile(file, (err, data) => {
      if (err) return rej(err)
      res(data)
    })
  })
}

function getComponentFilename(comp) {
  return `${componentsSrc}/${comp.filename}/${comp.filename}.component.html`
}

async function parseComponent(comp) {
  try {
    const data = await readFilePromise(comp.filename)
    const contents = data.toString()

    const components = _(contents.match(/<app-([^>"]|"([^"\\]|\\.)*")*>/gus))
      .map(comp => comp.replace('<app-', ''))
      .map(comp => comp.match(/^\S*/)[0])
      .map(comp => comp.replace('>', ''))
      .map(comp => ({ name: pascalCase(comp), filename: comp }))
      .map(comp => ({ ...comp, filename: getComponentFilename(comp) }))
      .value()

    if (!components.length) return comp

    const subComps = await Promise.all(_.map(components, comp => parseComponent(comp)))

    return {
      name: comp.name,
      subComponents: Array.isArray(subComps) ? subComps : [subComps]
    }
  } catch (e) {
    return comp
  }
}

async function parseRouting(file) {
  const data = await readFilePromise(file)
  const contents = data.toString()

  const components = _(contents.match(/component: (\S*)/g))
    .map(comp => comp.replace('component: ', ''))
    .map(comp => comp.replace(',', ''))
    .map(comp => ({ name: comp }))
    .map(comp => ({ ...comp, filename: comp.name.replace('Component', '') }))
    .map(comp => ({ ...comp, filename: paramCase(comp.filename) }))
    .map(comp => ({ ...comp, filename: getComponentFilename(comp) }))
    .value()

  for (const comp of components) {
    const parsed = await parseComponent(comp)
    tree.push(parsed)
  }
}

function displayTree(node, depth = 0) {
  if (Array.isArray(node)) return _.each(node, comp => displayTree(comp))
  console.log('  '.repeat(depth), node.name)
  if (node.subComponents) _.each(node.subComponents, comp => displayTree(comp, depth + 1))
}

glob(`${src}/**/*routing.module.ts`, (err, matches) => {
  if (err) return console.log(err)

  Promise.all(_.map(matches, file => parseRouting(file)))
    // .then(() => console.log('tree', tree[tree.length - 1]))
    .then(() => displayTree(tree))
})