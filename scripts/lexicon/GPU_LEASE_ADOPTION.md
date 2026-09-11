# GPU Watchbill lease adoption (Lexsycon)

Singularity provides `~/Projects/singularity/scripts/estate_gpu_lexsycon_shim.py`.

Before Comfy submissions in `grow-and-publish.sh` / art workers:

```python
import sys
sys.path.insert(0, '/home/xsyprime/Projects/singularity/scripts')
from estate_gpu_lexsycon_shim import admit, release
lease = admit(task_id='lexsycon-night')
try:
    ...  # existing paint work
finally:
    release(lease)
```

Do not clear the Comfy queue. Fail closed on deferral. Reviewed separately from
Singularity Watchbill; this note is the adoption contract, not an automatic hook.
