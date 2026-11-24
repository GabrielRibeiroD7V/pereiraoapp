import {Link,useLocation} from 'react-router-dom';
import type {LinkProps} from 'react-router-dom';
import {rememberPostScroll} from './postReturn';
export function PostLink({onClick,...props}:Omit<LinkProps,'state'>) {
  const location=useLocation();
  return <Link {...props} state={{postOrigin:{path:location.pathname+location.search,key:location.key}}} onClick={event=>{rememberPostScroll(location.key,window.scrollY);onClick?.(event);}}/>;
}
