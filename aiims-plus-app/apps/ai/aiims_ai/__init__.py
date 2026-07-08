"""AIIMS+ operational-only AI plane (AIDR-0002/0003).

Constitution-bound: assists operations ONLY — never diagnosis, never treatment,
never an autonomous clinical decision, never a write path. Reached only via the
core's AiGateway port. PHI is redacted before any model call (AIDR-0008); every
output is labelled and human-verified (AIDR-0010); AI failure never blocks care
(AIDR-0014).
"""

__version__ = "0.7.0"
