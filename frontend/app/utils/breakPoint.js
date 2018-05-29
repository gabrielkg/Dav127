
/*----------------------------------------------------------------------------*/

/** breakPoint() will trace & stop on just the first call when breakPointEnable is 1.
 * example of use : set breakPointEnable = 1; before a scenario which triggers
 * many calls to breakPoint().
 */
let breakPointEnable = 1;
let breakPoint_trace = 0;
let breakInDebugger = true;

/** an improvised assert / debugger .
 * Only useful with Web Inspector, no effect otherwise, apart from javascript console trace.
 */
function breakPoint()
{
  if ((breakPointEnable > 0) || (breakPoint_trace > 1) )
    console.log.apply(arguments);
  if (breakPointEnable > 0)
  {
    if (breakPoint_trace > 0)
    {
      console.log("breakPoint", breakPointEnable);
    }
    --breakPointEnable;
    /* absorbed this feature from breakToDebugger() */
    /* comment out debugger when not in use - it impacts optimisation
 */
    if (breakInDebugger)
      debugger;
  }
}

/** very rough - could be a class, but could also replace with a standard module. */
function breakPointEnableSet(count)
{
  breakPointEnable = count;
}

/*----------------------------------------------------------------------------*/

export { breakPoint, breakPointEnableSet };
