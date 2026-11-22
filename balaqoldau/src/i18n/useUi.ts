import {useLocation} from 'react-router-dom';
// Subscribe components to the existing URL locale; no parallel language store.
export function useUi(){useLocation();}
