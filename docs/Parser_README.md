The Parser superclass is a basic interface for the json parsing methods the user wants to implement. It uses ABC to force inheritance on child classes.

n.b: Although made to work with .json configuration files originally, the Parser implementation itself would currently work fine with any refular file, as it only provides a basic open/store capacity.

# Parameters

configfile [Default=None]: The name of the configuration file.

# How it works

The Parser stores the configfile's contents as a list of keywords that should later be retrieved from a data architecture (typically json format) through the parse (immediate parsing) or process (returns a generator) functions.
These functions are declared as abstract using the ABC module, thus forcing any inheriting parser (rss, twitter, facebook...) to implement their own actual parsing.

# Dependencies

systemtools.basics
abc
