// Module 16565.
import { useEffect, useLayoutEffect } from 'react';
import { IS_CLIENT } from './is-client';

export const useIsomorphicEffect = IS_CLIENT ? useLayoutEffect : useEffect;
