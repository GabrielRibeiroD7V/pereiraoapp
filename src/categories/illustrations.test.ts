import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {it,expect} from 'vitest';
import {categoryImage,homeCategoryIds} from '../config/categories';
import {categoryCatalog16} from '../test/categoryCatalog';
const originals={"climatizacao": "ff4afd488fa40a5a7aa64cb08e0b4fddb3918497d57a92c9fa46cf4caf3fdd98", "pintura": "62e7ce586708101837789da80c04f6e02b95745fe2a4c7c82dc2561da9a5c5e3", "construcao": "dbc714add05f03368dd6cd2762d9cdcce328a351b44802a17e53dab5f4399cb0", "eletrica": "28a377d24470dc2ae67259f8fbc97f2f1f85cfe19930edd81c295c908f1a4448", "marcenaria": "b792668c3a79da2016256129e31e8b9f577793f11bc7b5b16788629c1063a3e6", "limpeza": "4f1f056aa8a55580265171648f96617cd0adb1ba85bd911500aaaa564e936ea3"};
it('preserva byte a byte as seis ilustrações oficiais',()=>{
 for(const [id,hash] of Object.entries(originals))expect(createHash('sha256').update(readFileSync('public/images/categories/illustrations/'+id+'.svg')).digest('hex')).toBe(hash);
});
it.each(categoryCatalog16)('SVG próprio de $id é local, completo e sem conteúdo ativo',category=>{
 const image=categoryImage(category.id);expect(image).not.toBeNull();
 const xml=readFileSync('public'+image!.src,'utf8');expect(xml).toContain('viewBox="0 0 160 112"');expect(xml).not.toMatch(/<script|<foreignObject|<image|https?:\/\/(?!www.w3.org)|onload=|onclick=/i);
});
it('seleciona somente 12 destaques distintos sem redefinir as 16 opções',()=>{expect(homeCategoryIds).toHaveLength(12);expect(new Set(homeCategoryIds).size).toBe(12);expect(categoryCatalog16).toHaveLength(16);expect(categoryImage('inventada')).toBeNull();});
