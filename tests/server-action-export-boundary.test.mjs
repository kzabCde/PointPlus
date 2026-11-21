import test from 'node:test'
import assert from 'node:assert/strict'
import {readdirSync,readFileSync} from 'node:fs'
import {join,extname} from 'node:path'
import ts from 'typescript'

const root=new URL('../',import.meta.url)
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8')
function* files(dir){
  for(const entry of readdirSync(new URL('../'+dir,import.meta.url),{withFileTypes:true})){
    const path=join(dir,entry.name)
    if(entry.isDirectory())yield* files(path)
    else if(['.ts','.tsx','.js','.jsx'].includes(extname(entry.name)))yield path
  }
}
function serverActionExportViolations(path){
  const source=read(path)
  const kind=path.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS
  const ast=ts.createSourceFile(path,source,ts.ScriptTarget.Latest,true,kind)
  const first=ast.statements.find(statement=>!ts.isEmptyStatement(statement))
  if(!first||!ts.isExpressionStatement(first)||
     !ts.isStringLiteral(first.expression)||first.expression.text!=='use server')return []
  const failures=[]
  for(const statement of ast.statements){
    const exported=statement.modifiers?.some(m=>m.kind===ts.SyntaxKind.ExportKeyword)
    if(!exported)continue
    if(ts.isInterfaceDeclaration(statement)||ts.isTypeAliasDeclaration(statement))continue
    if(ts.isExportDeclaration(statement)&&statement.isTypeOnly)continue
    if(ts.isFunctionDeclaration(statement)&&
      statement.modifiers?.some(m=>m.kind===ts.SyntaxKind.AsyncKeyword))continue
    failures.push(path+':'+ast.getLineAndCharacterOfPosition(statement.getStart(ast)).line+
      ' exports non-async runtime value: '+statement.getText(ast).slice(0,85))
  }
  return failures
}

test('All top-level use server modules export async functions or TypeScript types only',()=>{
  const invalid=[...files('features'),...files('app')]
    .flatMap(serverActionExportViolations)
  assert.deepEqual(invalid,[],'Next.js runtime rejects exported non-async constants from a use server file')
})

test('Living creation form owns its serializable initial state, not the server action module',()=>{
  const action=read('features/living-books/actions.ts')
  const form=read('features/living-books/forms.tsx')
  assert.match(action,/^'use server'/)
  assert.match(action,/export async function createLivingBookAction/)
  assert.match(action,/export async function addLivingBookPageAction/)
  assert.doesNotMatch(action,/export (?:const|let|var) livingIdle/)
  assert.match(form,/const livingIdle:\s*LivingActionState\s*=\s*\{status:'idle',message:''\}/)
  assert.match(form,/useActionState\(createLivingBookAction,livingIdle\)/)
  assert.match(form,/useActionState\(addLivingBookPageAction,livingIdle\)/)
})
