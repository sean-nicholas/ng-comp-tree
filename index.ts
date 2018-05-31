import * as glob from 'glob'
import { readFile } from 'fs'
import * as _ from 'lodash'
import { paramCase, pascalCase } from 'change-case'
import { parse } from 'path'

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

    const subComps = await Promise.all(
      _(components)
        .filter(subComp => subComp.name !== comp.name)
        .map(comp => parseComponent(comp))
        .value()
    )

    const recursiveComps = _(components)
      .filter(subComp => subComp.name === comp.name)
      .map(comp => ({ ...comp, name: comp.name + ' – RECURSIVE' }))
      .value()

    const allSubComps = [...subComps, ...recursiveComps]

    return {
      name: comp.name,
      subComponents: Array.isArray(allSubComps) ? allSubComps : [allSubComps]
    }
  } catch (e) {
    return comp
  }
}

async function parseRouting(file) {
  const moduleName = pascalCase(parse(file).name.replace('.module', ''))
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

  const subComponents = await Promise.all(_.map(components, comp => parseComponent(comp)))

  tree.push({
    name: moduleName,
    subComponents
  })
}

function displayTree(node, depth = 0) {
  if (Array.isArray(node)) return _.each(node, comp => displayTree(comp))
  console.log('  '.repeat(depth), node.name)
  if (node.subComponents) _.each(node.subComponents, comp => displayTree(comp, depth + 1))
}

glob(`${src}/**/*routing.module.ts`, (err, matches) => {
  if (err) return console.log(err)

  Promise.all(_.map(matches, file => parseRouting(file)))
    // .then(() => console.log('tree', tree))
    .then(() => displayTree(tree))
})