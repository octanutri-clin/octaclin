import { lerEstadoEdicaoPersistida } from './estado-edicao-persistida';
const base={edicaoSnapshotCriptografado:undefined as Buffer|undefined,edicaoProtegida:false,edicaoMaterializadaRevisao:null as number|null,rascunhoRevisao:1};
const documento={schemaVersao:1,refeicoes:[]};
it('legado sem snapshot mantém semântica existente sem decifrar',()=>{const decifrar=jest.fn();expect(lerEstadoEdicaoPersistida(base,decifrar)).toEqual({edicaoEstado:'legado'});expect(decifrar).not.toHaveBeenCalled();});
it('edição protegida sem materialização atual não fica legada',()=>{expect(lerEstadoEdicaoPersistida({...base,edicaoProtegida:true},()=>{throw new Error();})).toEqual({edicaoEstado:'indisponivel'});});
it.each([{materializada:1,estado:'materializada'},{materializada:0,estado:'pendente'}])('documento validado com materialização $materializada retorna $estado',({materializada,estado})=>{
 expect(lerEstadoEdicaoPersistida({...base,edicaoSnapshotCriptografado:Buffer.alloc(1),edicaoMaterializadaRevisao:materializada},()=>JSON.stringify(documento))).toEqual({edicaoEstado:estado,documentoEdicao:documento});
});
it.each(['{','null','{}',JSON.stringify({...documento,extra:'CANARIO'})])('documento inválido falha fechado sem conteúdo de erro',texto=>{
 expect(lerEstadoEdicaoPersistida({...base,edicaoSnapshotCriptografado:Buffer.alloc(1)},()=>texto)).toEqual({edicaoEstado:'indisponivel'});
});
it('erro de cifragem não escapa com conteúdo sensível',()=>{expect(lerEstadoEdicaoPersistida({...base,edicaoSnapshotCriptografado:Buffer.alloc(1)},()=>{throw new Error('CANARIO');})).toEqual({edicaoEstado:'indisponivel'});});
