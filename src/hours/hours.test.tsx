import{fireEvent,render,screen,waitFor}from'@testing-library/react';
import{MemoryRouter}from'react-router-dom';import{describe,it,expect,vi}from'vitest';
import{HoursProvider}from'./HoursProvider';import{WorkingHoursEditor,WorkingHoursDisplay}from'./WorkingHours';
import{emptyHours,openAt,periodLabel,validateHours}from'./model';import type{HoursRepository,WorkingHours}from'./model';
const configured=():WorkingHours=>({...emptyHours(),enabled:true,schedule:[[],[{start:'08:00',end:'12:00'},{start:'13:00',end:'18:00'}],[],[],[],[],[]]});
describe('horários e fuso',()=>{
 it('não inventa horários para perfil sem cadastro',()=>{expect(validateHours(emptyHours())).toBe('');expect(openAt(emptyHours())).toBeNull();expect(validateHours({...emptyHours(),enabled:true})).toMatch(/pelo menos um dia/);});
 it('aceita intervalos de almoço e rejeita sobreposição e horário inválido',()=>{const v=configured();expect(validateHours(v)).toBe('');v.schedule[1]![1]!.start='11:00';expect(validateHours(v)).toMatch(/sobrepostos/);v.schedule[1]![1]!.start='25:00';expect(validateHours(v)).toMatch(/Preencha/);});
 it('respeita abertura inclusiva, fechamento exclusivo e intervalo',()=>{const h=configured();expect(openAt(h,new Date('2026-11-23T12:00:00Z'))).toBe(true);expect(openAt(h,new Date('2026-11-23T16:00:00Z'))).toBe(false);expect(openAt(h,new Date('2026-11-23T17:00:00Z'))).toBe(true);expect(openAt(h,new Date('2026-11-23T22:00:00Z'))).toBe(false);});
 it('usa fuso do negócio, não o fuso do visitante',()=>{const h=configured(),at=new Date('2026-11-23T11:30:00Z');expect(openAt(h,at)).toBe(false);expect(openAt({...h,timezone:'America/Sao_Paulo'},at)).toBe(true);});
 it('calcula madrugada e detecta sobreposição na virada da semana',()=>{const h={...emptyHours(),enabled:true};h.schedule[6]=[{start:'22:00',end:'06:00'}];expect(openAt(h,new Date('2026-11-22T05:00:00Z'))).toBe(true);expect(openAt(h,new Date('2026-11-22T10:00:00Z'))).toBe(false);h.schedule[0]=[{start:'05:00',end:'07:00'}];expect(validateHours(h)).toMatch(/sobrepostos/);});
 it('24 horas é explícito e funciona no dia seguinte',()=>{const h={...emptyHours(),enabled:true};h.schedule[1]=[{start:'08:00',end:'08:00'}];expect(periodLabel(h.schedule[1][0]!)).toBe('24 horas');expect(openAt(h,new Date('2026-11-24T11:59:00Z'))).toBe(true);expect(openAt(h,new Date('2026-11-24T12:00:00Z'))).toBe(false);expect(periodLabel({start:'22:00',end:'06:00'})).toContain('dia seguinte');});
 it('limita a dois intervalos e não aceita fuso desconhecido',()=>{const h=configured();h.schedule[1]!.push({start:'20:00',end:'21:00'});expect(validateHours(h)).toMatch(/dois intervalos/);expect(validateHours({...emptyHours(),timezone:'UTC'})).toMatch(/fuso/);});
});
function fixture(){let saved:WorkingHours|null=null;return{get saved(){return saved;},repository:{available:async()=>true,get:vi.fn(async()=>({available:true,data:saved})),save:vi.fn(async(_id:string,value:WorkingHours)=>{saved=structuredClone({...value,updatedAt:'2026-11-25T12:00:00Z'});})} satisfies HoursRepository};}
function editor(r:HoursRepository){return render(<HoursProvider repository={r}><WorkingHoursEditor businessId="owned-business"/></HoursProvider>);}
async function fillMonday(){fireEvent.click(await screen.findByLabelText('Informar dias e horários'));fireEvent.click(screen.getByLabelText('Segunda-feira'));}
it('edição cancela sem gravar, salva e recupera apenas dados persistidos',async()=>{
 const f=fixture();const view=editor(f.repository);await waitFor(()=>expect(screen.getByLabelText('Informar dias e horários')).toBeEnabled());await fillMonday();fireEvent.click(screen.getByRole('button',{name:'Cancelar horários'}));expect(f.repository.save).not.toHaveBeenCalled();expect(screen.getByLabelText('Informar dias e horários')).not.toBeChecked();
 await fillMonday();fireEvent.click(screen.getByLabelText('Aceito contatos fora desses horários'));fireEvent.click(screen.getByRole('button',{name:'Salvar horários'}));await screen.findByText(/Horários salvos/);expect(f.saved?.schedule[1]).toEqual([{start:'08:00',end:'18:00'}]);expect(f.saved?.acceptsOutsideHours).toBe(true);
 view.unmount();editor(f.repository);await waitFor(()=>expect(screen.getByLabelText('Segunda-feira')).toBeChecked());expect(screen.getByLabelText('Início de Segunda-feira, intervalo 1')).toHaveValue('08:00');
});
it('falha mantém campos e horários salvos anteriores; conflito permite recarregar explicitamente',async()=>{
 const f=fixture();f.repository.save.mockRejectedValueOnce({code:'40001'});editor(f.repository);await waitFor(()=>expect(screen.getByLabelText('Informar dias e horários')).toBeEnabled());await fillMonday();fireEvent.change(screen.getByLabelText('Fim de Segunda-feira, intervalo 1'),{target:{value:'17:30'}});fireEvent.click(screen.getByRole('button',{name:'Salvar horários'}));await screen.findByRole('alert');expect(screen.getByLabelText('Fim de Segunda-feira, intervalo 1')).toHaveValue('17:30');expect(f.saved).toBeNull();fireEvent.click(screen.getByRole('button',{name:'Descartar edição e recarregar horários'}));await waitFor(()=>expect(screen.getByLabelText('Informar dias e horários')).not.toBeChecked());
});
it('não permite salvar sem migração nem transforma falha de rede em ausência de horários',async()=>{
 const f=fixture();f.repository.get.mockResolvedValueOnce({available:false,data:null});const view=editor(f.repository);await screen.findByText(/aguardam ativação autorizada/);expect(screen.getByRole('button',{name:'Salvar horários'})).toBeDisabled();view.unmount();f.repository.get.mockRejectedValueOnce(Error('offline'));editor(f.repository);await screen.findByRole('alert');expect(screen.queryByText(/aguardam ativação autorizada/)).not.toBeInTheDocument();
});
it('visualização consulta somente versão salva e pública quando solicitada',async()=>{
 const f=fixture();await f.repository.save('owned-business',configured());render(<MemoryRouter><HoursProvider repository={f.repository}><WorkingHoursDisplay businessId="owned-business" publicOnly/></HoursProvider></MemoryRouter>);await screen.findByText('08:00–12:00 · 13:00–18:00');expect(f.repository.get).toHaveBeenCalledWith('owned-business',true);expect(screen.getByText(/feriados podem variar/)).toBeVisible();
});
it('horário não informado é mostrado sem fabricar aberto agora',async()=>{
 const f=fixture();render(<MemoryRouter><HoursProvider repository={f.repository}><WorkingHoursDisplay businessId="owned-business" publicOnly/></HoursProvider></MemoryRouter>);await screen.findByText('Horário não informado.');expect(screen.queryByText('Aberto agora')).not.toBeInTheDocument();
});
