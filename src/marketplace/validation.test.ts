import { describe, expect, it } from 'vitest';
import { imagePath, instagramLink, pageNumber, readFilters, searchTerm, validSlug, whatsappLink } from './validation';
describe('parâmetros e contatos públicos', () => {
  it('limita termos, páginas e enums da URL sem aceitar operadores como filtros', () => {
    expect(readFilters(new URLSearchParams('q=%20pintura%20&categoria=nao-existe&tipo=admin&cidade=../secret'))).toEqual({ query: 'pintura', categoryId: '', cityId: 'mundo-novo-ms', type: '' });
    expect(readFilters(new URLSearchParams('cidade=todas&tipo=empresa&categoria=eletrica')).cityId).toBe('');
    expect(readFilters(new URLSearchParams({ q: 'a'.repeat(300) })).query).toHaveLength(200);
    expect([pageNumber('-8'), pageNumber('2.9'), pageNumber('Infinity')]).toEqual([1, 2, 1000]);
  });
  it('não permite introduzir gramática OR, curingas ou caminhos na busca', () => {
    expect(searchTerm('"%,name.not.is.null),status.eq.draft*\\')).not.toMatch(/["%,).*\\]/);
    expect(searchTerm('Instalação & manutenção')).toBe('Instalação manutenção');
    expect(validSlug('../../private')).toBe(false);
  });
  it('normaliza telefone e codifica mensagem contextual', () => {
    const url = new URL(whatsappLink('+55 (67) 99999-1234', 'A & B')!);
    expect(url.hostname).toBe('wa.me'); expect(url.pathname).toBe('/5567999991234');
    expect(url.searchParams.get('text')).toContain('A & B no PEREIRÃO');
  });
  it.each(['javascript:alert(1)', 'https://evil.test', '55abc99999', '00000000000', '123'])('omite telefone inválido %s', (value) => expect(whatsappLink(value, 'Teste')).toBeNull());
  it.each(['@perfil.teste', 'https://instagram.com/perfil.teste/', 'https://www.instagram.com/perfil.teste'])('normaliza Instagram %s', (value) => expect(instagramLink(value)).toBe('https://www.instagram.com/perfil.teste/'));
  it.each(['javascript:alert(1)', 'https://instagram.com.evil.test/a', 'https://evil@instagram.com/a', 'https://instagram.com/a?url=evil', 'https://instagram.com/a/b', 'https://instagram.com:444/a', '../a', 'a..b'])('omite Instagram inseguro %s', (value) => expect(instagramLink(value)).toBeNull());
  it('exige caminhos canônicos do próprio negócio', () => {
    const id = '00000000-0000-4000-8000-000000000001', photo = '00000000-0000-4000-8000-000000000101';
    expect(imagePath(id, `${id}/portfolio/${photo}.webp`)).toBe(true);
    expect(imagePath(id, `other/portfolio/${photo}.webp`)).toBe(false);
    expect(imagePath(id, `${id}/portfolio/../../secret`)).toBe(false);
    expect(imagePath(id, `https://evil.test/${photo}.webp`)).toBe(false);
  });
});

it.each([
  ['(67) 99999-1234','5567999991234'],
  ['(44) 3333-1234','554433331234'],
  ['(55) 99999-1234','5555999991234'],
  ['+55 (67) 99999-1234','5567999991234'],
  ['5567999991234','5567999991234'],
  ['+1 (202) 555-0123','12025550123'],
])('monta WhatsApp internacional sem alterar telefone persistido: %s', (value,expected)=>{
  expect(new URL(whatsappLink(value,'Perfil local')!).pathname).toBe('/'+expected);
  expect(new URL(whatsappLink(value,'Perfil local')!).searchParams.get('text')).toContain('Perfil local');
});
