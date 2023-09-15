# Senec live counters
## Introduction
At September 1st 2023, Senec introduced a new firmware to their photovoltaics and storage system,
which switched off the "statistics" section of their web api interface.
As a result, all produced energy statistics went blank.
Thanks to the author of the senec adapter, this could be overcome with a new adapter version,
which utilized the cloud api of Senec in order to get the energy statistics. At first - after only
two days, nobl introduced the daily values for the dashboard into the adapter, later also statistics for
year, month, week and day were read from the cloud. A little later, all time values were also calculated, 
and even a all-time calculation could be done by the adapter.

Nevertheless, this lead to a loss of data in the tracking database, and tracking in this week had been lost.

As I normally switch on the tracking of a lot of datapoints into a mySQL database, my thought was if it
wasn't possible to recover a lot of the missing data. At least, it should be possible to recover all the history
after the daily cloud API was introduced.

## Basic principle
This script does create all-time statistics datapoints for the following values
- energy produced (LIVE_PV_GEN)
- house consumption (LIVE_HOUSE_CONS)
- ...

It uses the old (legacy) statistics datapoint to get a starting point for the values. Then, it reads from the database
all the values which have been read from the cloud API (daily dashboard), calculates the missing history value for the new
statistics DP and stores them into the DP.
After subscribing to the daily DP, it updates the all time DP continously.

The missing day(s) between the old interface stopping to work and the new DP cloud API datapoint causes of course an offset. But
what we can do, is try to recreate the offset by evaluating the datapoints for the current year - one in the _calc section of the 
adapter, the other in the cloud API.

This gives most of the continuity of data which can be achieved.

## Other issues ...
Another issue happens, if - due to maintenance or other issues - the admin of iobroker is forced to reapply a backup of the
iobroker instance itself. If the datapoints are not stored externally (Redis), this means the whole iobroker makes a jump back
in time. For counters which should refer to the value before, this causes jumps and really strange data.
This script tries to avoid that by not only tracking (subscribing) to the relevant datapoints, but also referring to their history
in the - external - mySQL database. If strange jumps in time are detected, the script falls back to the latest "good" value in 
the database. This of course also might lead to jumps, but thats the best available data in that situation, and it avoids 
the worst inconsistencies.
