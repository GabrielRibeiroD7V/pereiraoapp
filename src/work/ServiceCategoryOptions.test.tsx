import {fireEvent,render,screen,within} from '@testing-library/react';
import {expect,it,vi} from 'vitest';
import {ServiceEditor} from './ServiceEditor';
import {categories} from '../config/categories';
it('expõe as seis categorias no seletor nativo e não grava ao selecionar/cancelar',()=>{const save=vi.fn(),close=vi.fn();render(<ServiceEditor catalog={{categories:categories.map(({id,name})=>({id,name})),cities:[]}} onSave={save} onClose={close}/>);const select=screen.getByLabelText('Categoria');expect(select.tagName).toBe('SELECT');expect(within(select).getAllByRole('option')).toHaveLength(7);fireEvent.change(select,{target:{value:'construcao'}});expect(select).toHaveValue('construcao');fireEvent.change(select,{target:{value:'eletrica'}});expect(select).toHaveValue('eletrica');fireEvent.click(screen.getByRole('button',{name:'Cancelar'}));expect(save).not.toHaveBeenCalled();expect(close).toHaveBeenCalledOnce();});
